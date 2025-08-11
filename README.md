# Frequency Tools

A TypeScript project for cryptocurrency trading analysis and automation using the Binance API.

## Features

### 🎯 Market Orders with Limits
Execute market orders with intelligent limit order management for futures trading.

### 📊 Coefficient of Variation Analysis
Analyze cryptocurrency volatility using statistical coefficient of variation calculations on **configurable interval** candlestick data. **Only includes symbols with substantial data (≥400 out of 500 max data points)** from Binance API.

### 🔗 Correlation Analysis
Calculate correlation coefficients between cryptocurrency pairs to identify how their price movements relate to each other. **Uses symbols with at least 500 data points** to ensure reliable statistical relationships.

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

### Correlation Analysis

#### Demo Analysis (12 popular cryptocurrencies)
```bash
# Default 1h intervals with 100 data points
npm run corr-sample

# Custom interval and data points
npm run corr-sample [interval] [limit]
```

Examples:
```bash
npm run corr-sample 1h 500   # 1-hour intervals, 500 data points (~20 days)
npm run corr-sample 4h 300   # 4-hour intervals, 300 data points (~50 days)
npm run corr-sample 1d 100   # 1-day intervals, 100 data points (~100 days)
```

#### Full Analysis (all symbols with ≥500 data points)
```bash
# Default 12h intervals
npm run corr-analysis

# Custom interval
npm run corr-analysis [interval]
```

Examples:
```bash
npm run corr-analysis 1h    # 1-hour intervals
npm run corr-analysis 4h    # 4-hour intervals
npm run corr-analysis 8h    # 8-hour intervals
npm run corr-analysis 12h   # 12-hour intervals (default)
npm run corr-analysis 1d    # 1-day intervals
```

**Quick shortcuts for common intervals:**
```bash
npm run corr-1h    # 1-hour correlation analysis
npm run corr-4h    # 4-hour correlation analysis
npm run corr-8h    # 8-hour correlation analysis
npm run corr-12h   # 12-hour correlation analysis
npm run corr-1d    # 1-day correlation analysis
```

## Coefficient of Variation Explained

The Coefficient of Variation (CV) is a statistical measure of relative variability:

**Formula:** `CV = (Standard Deviation / Mean) × 100`

**Interpretation:**
- **Higher CV** = More volatile (riskier but potentially more profitable)
- **Lower CV** = More stable (less risky, more predictable)

## Correlation Analysis Explained

Correlation analysis measures the linear relationship between two cryptocurrency price movements using the Pearson correlation coefficient:

**Formula:** `r = Σ[(Xi - X̄)(Yi - Ȳ)] / √[Σ(Xi - X̄)²Σ(Yi - Ȳ)²]`

**Interpretation:**
- **+1.0** = Perfect positive correlation (prices move together)
- **+0.7 to +0.9** = Strong positive correlation
- **+0.3 to +0.7** = Moderate positive correlation
- **-0.3 to +0.3** = Little to no correlation
- **-0.7 to -0.3** = Moderate negative correlation
- **-0.9 to -0.7** = Strong negative correlation
- **-1.0** = Perfect negative correlation (prices move opposite)

**Trading Applications:**
- **Portfolio Diversification**: Choose cryptocurrencies with low correlation
- **Hedging Strategies**: Use negatively correlated pairs to reduce risk
- **Trend Following**: Identify cryptocurrencies that move together
- **Market Analysis**: Understand sector movements and market relationships

### Bitcoin Diversification Analysis

Both correlation analysis scripts now include a **Bitcoin Diversification Table** that shows cryptocurrencies with **correlation < 0.9 to Bitcoin**, helping you build a more diversified portfolio:

- **🟢 Excellent Diversifiers** (|r| < 0.3): Very low correlation to Bitcoin
- **🟡 Very Good Diversifiers** (0.3 ≤ |r| < 0.5): Low correlation to Bitcoin
- **🟠 Good Diversifiers** (0.5 ≤ |r| < 0.65): Moderate independence from Bitcoin
- **🔵 Moderate Diversifiers** (0.65 ≤ |r| < 0.75): Some independence from Bitcoin
- **🟣 Limited Diversifiers** (0.75 ≤ |r| < 0.85): Slight independence from Bitcoin
- **⚪ Minimal Diversifiers** (0.85 ≤ |r| < 0.9): Minimal independence from Bitcoin

**Expanded threshold (< 0.9)** provides **~30+ diversification candidates** for comprehensive portfolio options. This is particularly valuable since Bitcoin often dominates cryptocurrency market movements.

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
- `npm run start-watch` - Run with file watching for development

### Coefficient of Variation (CV) Scripts
- `npm run cv-sample [interval]` - Demo: Analyze 15 popular cryptocurrencies
- `npm run cv-analysis [interval]` - Full: Analyze all symbols with substantial data
- `npm run cv-1h` - 1-hour interval analysis
- `npm run cv-4h` - 4-hour interval analysis  
- `npm run cv-8h` - 8-hour interval analysis
- `npm run cv-12h` - 12-hour interval analysis
- `npm run cv-1d` - 1-day interval analysis

### Correlation Analysis Scripts
- `npm run corr-sample [interval] [limit]` - Demo: Analyze 12 popular cryptocurrencies
- `npm run corr-analysis [interval]` - Full: Analyze all symbols with ≥500 data points
- `npm run corr-1h` - 1-hour interval correlation analysis
- `npm run corr-4h` - 4-hour interval correlation analysis
- `npm run corr-8h` - 8-hour interval correlation analysis
- `npm run corr-12h` - 12-hour interval correlation analysis
- `npm run corr-1d` - 1-day interval correlation analysis