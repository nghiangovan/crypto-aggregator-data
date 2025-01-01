require('dotenv').config();
const LunarCrush = require('./lunarcrush/LunarCrush.js');
const CertikCrawler = require('./skynet_certik/CertikCrawler.js');
const cron = require('node-cron');
const os = require('os');

// MongoDB Configuration
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/crypto_db';

// Parse proxies with authentication
const parseProxies = () => {
  try {
    const proxiesEnv = process.env.PROXIES;
    if (!proxiesEnv) return [];

    const proxies = JSON.parse(proxiesEnv);
    // Validate and format proxies
    return proxies
      .map(proxy => {
        const [host, port, username, password] = proxy.split(':');
        return {
          host,
          port,
          username,
          password,
          url: `http://${username}:${password}@${host}:${port}`,
        };
      })
      .filter(proxy => proxy.host && proxy.port && proxy.username && proxy.password);
  } catch (error) {
    console.warn('Error parsing proxies:', error.message);
    return [];
  }
};

// Certik Configuration
const certikConfig = {
  mongoUrl: MONGO_URL,
  securityScoresCollection: process.env.SECURITY_SCORES_COLLECTION || 'security_scores',
  marketDataCollection: process.env.MARKET_DATA_COLLECTION || 'market_data',
  maxThreads: process.env.MAX_THREADS ? parseInt(process.env.MAX_THREADS, 10) : Math.max(os.cpus().length - 2, 1),
  maxTopsProjects: process.env.MAX_TOPS_PROJECTS ? parseInt(process.env.MAX_TOPS_PROJECTS, 10) : null,
  proxies: parseProxies(),
  puppeteerOptions: {
    headless: process.env.NODE_ENV === 'production',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920x1080',
      ...(parseProxies().length > 0 ? [`--proxy-server=${parseProxies()[0].url}`] : []),
    ],
    ignoreHTTPSErrors: true,
  },
};

// Add proxy authentication function
async function setupProxyAuth(page, proxy) {
  if (proxy && proxy.username && proxy.password) {
    await page.authenticate({
      username: proxy.username,
      password: proxy.password,
    });
  }
}

// LunarCrush Configuration
const lunarConfig = {
  mongoUrl: MONGO_URL,
  collectionName: 'lunarcrush_data',
  apiKey: process.env.LUNARCRUSH_API_KEY,
};

// Validate required environment variables
if (!certikConfig.mongoUrl) {
  console.error('Missing MongoDB URL. Please check your .env file.');
  process.exit(1);
}

if (!lunarConfig.apiKey) {
  console.error('Missing required LunarCrush API key. Please check your .env file.');
  process.exit(1);
}

async function handleCertikDailyMarketData() {
  let crawler;
  try {
    crawler = new CertikCrawler(certikConfig);
    console.log('Running Certik daily market data crawler...');

    // Get the first proxy if available
    const proxy = certikConfig.proxies.length > 0 ? certikConfig.proxies[0] : null;
    if (proxy) {
      console.log(`Using proxy: ${proxy.host}:${proxy.port}`);
    }

    await crawler.crawlData(certikConfig.marketDataCollection);
  } catch (error) {
    console.error('Error in Certik daily market data crawler:', error);
  } finally {
    if (crawler) await crawler.close();
  }
}

async function handleCertikSynchronizedCrawl() {
  let crawler;
  try {
    crawler = new CertikCrawler(certikConfig);
    console.log('Running Certik synchronized crawl for both collections...');

    // Get the first proxy if available
    const proxy = certikConfig.proxies.length > 0 ? certikConfig.proxies[0] : null;
    if (proxy) {
      console.log(`Using proxy: ${proxy.host}:${proxy.port}`);
    }

    await crawler.crawlData([certikConfig.securityScoresCollection, certikConfig.marketDataCollection], {
      synchronized: true,
    });
  } catch (error) {
    console.error('Error in Certik synchronized crawl:', error);
    // Log more details about the error
    if (error.message.includes('ERR_INVALID_AUTH_CREDENTIALS')) {
      console.error('Proxy authentication failed. Please check your proxy credentials.');
      if (certikConfig.proxies.length > 0) {
        console.error('Current proxy configuration:', {
          host: certikConfig.proxies[0].host,
          port: certikConfig.proxies[0].port,
          hasCredentials: !!(certikConfig.proxies[0].username && certikConfig.proxies[0].password),
        });
      }
    }
  } finally {
    if (crawler) await crawler.close();
  }
}

async function handleLunarCrushCrawl() {
  let lunarCrush;
  try {
    lunarCrush = new LunarCrush(lunarConfig);
    console.log('Running LunarCrush data crawler...');
    await lunarCrush.ensureCollection();
    const data = await lunarCrush.fetchCryptocurrencies();
    await lunarCrush.saveToMongoDB(data);
  } catch (error) {
    console.error('Error in LunarCrush crawler:', error);
  } finally {
    if (lunarCrush) await lunarCrush.close();
  }
}

async function main() {
  try {
    console.log('Starting initial data collection...');
    console.log('Configuration:', {
      ...certikConfig,
      proxies: certikConfig.proxies.length ? `${certikConfig.proxies.length} proxies configured` : 'No proxies',
    });

    // Run initial Certik synchronized crawl
    await handleCertikSynchronizedCrawl();

    // Run initial LunarCrush crawl
    await handleLunarCrushCrawl();

    // Set up scheduled jobs
    console.log('Setting up scheduled crawlers...');

    // Schedule Certik crawlers - Daily at 00:00 UTC
    cron.schedule(
      '0 0 * * *',
      async () => {
        if (new Date().getDay() === 0) {
          // On Sundays, run synchronized Certik crawl for both collections
          await handleCertikSynchronizedCrawl();
        } else {
          // On other days, only run Certik market data
          await handleCertikDailyMarketData();
        }

        // Run LunarCrush crawler after Certik completes
        await handleLunarCrushCrawl();
      },
      {
        timezone: 'UTC',
      },
    );

    console.log('Crawlers scheduled (all times in UTC):');
    console.log('- Certik Market Data: Daily at 00:00');
    console.log('- Certik Synchronized Market Data and Security Scores: Sundays at 00:00');
    console.log('- LunarCrush: Daily at 00:00 (after Certik)');
  } catch (error) {
    console.error('An error occurred during main execution:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error);

// Handle process termination
process.on('SIGINT', async () => {
  console.log('Received SIGINT. Cleaning up...');
  try {
    const crawler = new CertikCrawler(certikConfig);
    const lunarCrush = new LunarCrush(lunarConfig);
    await Promise.all([crawler.close(), lunarCrush.close()]);
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
  process.exit(0);
});

// Keep the process running
process.stdin.resume();
