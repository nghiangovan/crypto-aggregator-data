# Crypto Aggregator

Combines data from LunarCrush and Certik Skynet into a unified crypto analytics platform. This project uses git submodules to manage the LunarCrush API integration and Certik Skynet crawler components.

## Features

- **Unified Data Collection**

  - LunarCrush API integration for social metrics and market data
  - Certik Skynet crawler for security scores and market data
  - Synchronized data collection and storage

- **Intelligent Scheduling**

  - Daily Certik market data collection (00:00 UTC)
  - Weekly synchronized Certik security scores (Sundays 00:00 UTC)
  - Daily LunarCrush updates (after Certik completion)

- **Advanced Features**
  - Multi-threaded Certik data collection
  - Automatic CPU core optimization
  - MongoDB storage with optimized indexing
  - Configurable proxy support
  - Comprehensive error handling
  - Automatic retry mechanisms

## Prerequisites

- Node.js (v16 or higher)
- MongoDB
- Yarn (preferred)
- Git (for submodule management)

## Setup

1. Clone the repository with submodules:

```bash
git clone --recursive <repo-url>
cd crypto-aggregator
```

2. Install dependencies (including submodules):

```bash
yarn install
```

3. Configure environment variables:

```bash
cp .env.example .env
# Edit .env with your settings
```

4. Run the application:

```bash
# Production mode
yarn start

# Development mode
yarn dev
```

## Project Structure

```
crypto-aggregator/
├── lunarcrush/           # LunarCrush API integration (submodule)
├── skynet_certik/        # Certik Skynet crawler (submodule)
├── index.js              # Main application entry
├── .env.example          # Environment variables template
├── .yarnrc.yml          # Yarn configuration
└── package.json          # Project configuration
```

## Configuration

### Environment Variables (.env)

```env
# MongoDB Configuration
MONGO_URL=mongodb://localhost:27017/crypto_db

# LunarCrush Configuration
LUNARCRUSH_API_KEY=your_api_key

# Certik Configuration
SECURITY_SCORES_COLLECTION=security_scores
MARKET_DATA_COLLECTION=market_data
MAX_THREADS=4
MAX_TOPS_PROJECTS=100
PROXIES='["HOST:PORT:USER:PASS"]'
```

## Data Collection Schedule

### Daily Schedule (UTC)

- **00:00**:
  1. Certik market data collection
  2. LunarCrush data update

### Weekly Schedule (UTC)

- **Sunday 00:00**:
  1. Synchronized Certik security scores and market data collection
  2. LunarCrush data update

## Submodule Management

### Update Submodules

```bash
git submodule update --remote
```

### Individual Submodule Setup

```bash
# LunarCrush setup
cd lunarcrush
yarn install

# Certik setup
cd skynet_certik
yarn install
```

## API & Data Structure

### LunarCrush Data

- Social metrics
- Market data
- Galaxy scores
- Alt rankings

### Certik Data

- Security scores
- Audit information
- Market metrics
- Project status

## Error Handling

The application includes comprehensive error handling for:

- API failures
- Network issues
- Database connection problems
- Rate limiting
- Data validation

## Troubleshooting

### Submodule Issues

```bash
# Reinitialize submodules
git submodule update --init --recursive

# Check submodule status
git submodule status
```

### MongoDB Issues

- Verify MongoDB is running
- Check connection string in .env
- Ensure proper database permissions
- Verify collection existence and indexes

### API/Crawler Issues

- Validate API keys
- Check proxy configuration
- Review rate limiting settings
- Clear cookies.json if needed

## Development

### Debug Mode

```bash
# Start in development mode
yarn dev

# Debug with Node.js inspector
node --inspect index.js
```

### Adding New Features

1. Update relevant submodule
2. Test changes independently
3. Update main project integration
4. Update documentation

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

[Your License]

## Support

For support, please open an issue in the repository.
