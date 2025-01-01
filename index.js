require('dotenv').config();
const LunarCrush = require('./lunarcrush/LunarCrush.js');
const CertikCrawler = require('./skynet_certik/CertikCrawler.js');
const cron = require('node-cron');
const os = require('os');

// MongoDB Configuration
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/crypto_db';

// Certik Configuration
const certikConfig = {
  mongoUrl: MONGO_URL,
  securityScoresCollection: process.env.SECURITY_SCORES_COLLECTION,
  marketDataCollection: process.env.MARKET_DATA_COLLECTION,
  maxThreads: process.env.MAX_THREADS ? parseInt(process.env.MAX_THREADS, 10) : Math.max(os.cpus().length - 2, 1),
  maxTopsProjects: process.env.MAX_TOPS_PROJECTS ? parseInt(process.env.MAX_TOPS_PROJECTS, 10) : null,
  // proxies: process.env.PROXIES ? JSON.parse(process.env.PROXIES) : [],
  proxies: [],
};

// LunarCrush Configuration
const lunarConfig = {
  mongoUrl: MONGO_URL,
  collectionName: 'lunarcrush_data',
  apiKey: process.env.LUNARCRUSH_API_KEY,
};

// Validate required environment variables
if (!certikConfig.mongoUrl || !certikConfig.securityScoresCollection || !certikConfig.marketDataCollection) {
  console.error('Missing required Certik environment variables. Please check your .env file.');
  process.exit(1);
}

if (!lunarConfig.apiKey) {
  console.error('Missing required LunarCrush API key. Please check your .env file.');
  process.exit(1);
}

async function handleCertikDailyMarketData() {
  try {
    const crawler = new CertikCrawler(certikConfig);
    console.log('Running Certik daily market data crawler...');
    await crawler.crawlData(certikConfig.marketDataCollection);
  } catch (error) {
    console.error('Error in Certik daily market data crawler:', error);
  }
}

async function handleCertikSynchronizedCrawl() {
  try {
    const crawler = new CertikCrawler(certikConfig);
    console.log('Running Certik synchronized crawl for both collections...');
    await crawler.crawlData([certikConfig.securityScoresCollection, certikConfig.marketDataCollection], {
      synchronized: true,
    });
  } catch (error) {
    console.error('Error in Certik synchronized crawl:', error);
  }
}

async function handleLunarCrushCrawl() {
  try {
    const lunarCrush = new LunarCrush(lunarConfig);
    console.log('Running LunarCrush data crawler...');
    await lunarCrush.ensureCollection();
    const data = await lunarCrush.fetchCryptocurrencies();
    await lunarCrush.saveToMongoDB(data);
    await lunarCrush.close();
  } catch (error) {
    console.error('Error in LunarCrush crawler:', error);
  }
}

async function main() {
  try {
    console.log('Starting initial data collection...');

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
