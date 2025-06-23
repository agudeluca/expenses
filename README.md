# Frequency Tools

A TypeScript project for cryptocurrency trading analysis and automation using the Binance API.

## Features

### 🎯 Market Orders with Limits
Execute market orders with intelligent limit order management for futures trading.

### 📊 Coefficient of Variation Analysis
Analyze cryptocurrency volatility using statistical coefficient of variation calculations on **configurable interval** candlestick data. **Only includes symbols with substantial data (≥400 out of 500 max data points)** from Binance API.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your Binance API credentials:
```env
API_KEY=your_binance_api_key
API_SECRET=your_binance_api_secret
```

## Usage

### Market Orders
Execute market orders with limit order management:
```bash
npm start <symbol> <quantity> <side> <isCoin>
```

Example:
```bash
npm start BTCUSDT 0.001 buy false
```

### Coefficient of Variation Analysis

#### Demo Analysis (15 popular cryptocurrencies)
```bash
# Default 12h intervals
npm run cv-sample

# Custom interval
npm run cv-sample [interval]
```

Examples:
```bash
npm run cv-sample 1h    # 1-hour intervals
npm run cv-sample 4h    # 4-hour intervals  
npm run cv-sample 1d    # 1-day intervals
```

#### Full Analysis (all symbols with substantial data)
```bash
# Default 12h intervals  
npm run cv-analysis

# Custom interval
npm run cv-analysis [interval]
```

Examples:
```bash
npm run cv-analysis 1h    # 1-hour intervals
npm run cv-analysis 4h    # 4-hour intervals
npm run cv-analysis 8h    # 8-hour intervals
npm run cv-analysis 12h   # 12-hour intervals (default)
npm run cv-analysis 1d    # 1-day intervals
```

**Quick shortcuts for common intervals:**
```bash
npm run cv-1h    # 1-hour analysis
npm run cv-4h    # 4-hour analysis  
npm run cv-8h    # 8-hour analysis
npm run cv-12h   # 12-hour analysis
npm run cv-1d    # 1-day analysis
npm run cv-1w    # 1-week analysis
```

## Coefficient of Variation Explained

The Coefficient of Variation (CV) is a statistical measure of relative variability:

**Formula:** `CV = (Standard Deviation / Mean) × 100`

**Interpretation:**
- **Higher CV** = More volatile (riskier but potentially more profitable)
- **Lower CV** = More stable (less risky, more predictable)

### Supported Intervals

**Minute intervals:** `1m`, `3m`, `5m`, `15m`, `30m`  
**Hour intervals:** `1h`, `2h`, `4h`, `6h`, `8h`, `12h`  
**Day intervals:** `1d`, `3d`  
**Week/Month:** `1w`, `1M`

### Data Requirements

- **Demo version**: Uses ~100 data points from the specified interval
- **Full analysis**: Requires **≥400 data points** (substantial portion of available data)
- **API Limitation**: Binance returns maximum 500 data points per request
- **Time Coverage**: Varies by interval (e.g., 500 × 1h = ~21 days, 500 × 1d = ~1.4 years)
- Only symbols with substantial trading history will appear in the full analysis

### Examples of Time Coverage

| Interval | 500 Data Points | 400 Data Points |
|----------|-----------------|-----------------|
| 1h       | ~21 days        | ~17 days        |
| 4h       | ~83 days        | ~67 days        |
| 8h       | ~167 days       | ~133 days       |
| 12h      | ~250 days       | ~200 days       |
| 1d       | ~1.4 years      | ~1.1 years      |
| 1w       | ~9.6 years      | ~7.7 years      |

## Scripts

### Basic Scripts
- `npm start` - Run market order functionality
- `npm run cv-sample [interval]` - Demo: Analyze 15 popular cryptocurrencies
- `npm run cv-analysis [interval]` - Full: Analyze all symbols with substantial data
- `npm run start-watch` - Run with file watching for development

### Quick Interval Scripts
- `npm run cv-1h` - 1-hour interval analysis
- `npm run cv-4h` - 4-hour interval analysis  
- `npm run cv-8h` - 8-hour interval analysis
- `npm run cv-12h` - 12-hour interval analysis
- `npm run cv-1d` - 1-day interval analysis
- `npm run cv-1w` - 1-week interval analysis