import Binance from "node-binance-api";
import "dotenv/config";

// Initialize Binance API
const binance = new Binance().options({
  APIKEY: process.env.API_KEY,
  APISECRET: process.env.API_SECRET,
});

// Type definitions for kline data
interface KlineData {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteAssetVolume: string;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: string;
  takerBuyQuoteAssetVolume: string;
  ignore: string;
}

interface SymbolPriceData {
  symbol: string;
  prices: number[];
  dataPoints: number;
}

interface CorrelationResult {
  symbol1: string;
  symbol2: string;
  correlation: number;
  dataPoints: number;
}

// Popular cryptocurrency symbols for sample analysis
const SAMPLE_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "ADAUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "DOTUSDT",
  "AVAXUSDT",
  "MATICUSDT",
  "LINKUSDT",
  "ATOMUSDT",
  "LTCUSDT",
];

// Function to get kline data for a symbol
async function getKlineData(
  symbol: string,
  interval: string = "1h",
  limit: number = 100
): Promise<KlineData[]> {
  try {
    const data = await binance.futuresCandles(symbol, interval);

    if (!Array.isArray(data)) {
      console.log(
        `Unexpected response format for ${symbol}:`,
        typeof data,
        data
      );
      return [];
    }

    // Map the data and limit to the specified number of data points
    const mappedData = data.map((kline: any) => ({
      openTime: kline[0],
      open: kline[1],
      high: kline[2],
      low: kline[3],
      close: kline[4],
      volume: kline[5],
      closeTime: kline[6],
      quoteAssetVolume: kline[7],
      numberOfTrades: kline[8],
      takerBuyBaseAssetVolume: kline[9],
      takerBuyQuoteAssetVolume: kline[10],
      ignore: kline[11],
    }));

    // Return the most recent data points up to the limit
    return mappedData.slice(-limit);
  } catch (error) {
    console.error(`Error fetching kline data for ${symbol}:`, error);
    return [];
  }
}

// Function to calculate Pearson correlation coefficient
function calculateCorrelation(prices1: number[], prices2: number[]): number {
  if (prices1.length !== prices2.length || prices1.length === 0) {
    return 0;
  }

  const n = prices1.length;
  const mean1 = prices1.reduce((sum, price) => sum + price, 0) / n;
  const mean2 = prices2.reduce((sum, price) => sum + price, 0) / n;

  let numerator = 0;
  let sumSq1 = 0;
  let sumSq2 = 0;

  for (let i = 0; i < n; i++) {
    const diff1 = prices1[i] - mean1;
    const diff2 = prices2[i] - mean2;
    numerator += diff1 * diff2;
    sumSq1 += diff1 * diff1;
    sumSq2 += diff2 * diff2;
  }

  const denominator = Math.sqrt(sumSq1 * sumSq2);
  if (denominator === 0) return 0;

  return numerator / denominator;
}

// Function to process a single symbol and get its price data
async function getSymbolPriceData(
  symbol: string,
  interval: string = "1h",
  limit: number = 100
): Promise<SymbolPriceData | null> {
  try {
    const klineData = await getKlineData(symbol, interval, limit);

    if (klineData.length === 0) {
      return null;
    }

    // Use closing prices for correlation calculation
    const closingPrices = klineData.map((kline) => parseFloat(kline.close));

    return {
      symbol,
      prices: closingPrices,
      dataPoints: klineData.length,
    };
  } catch (error) {
    console.error(`Error processing symbol ${symbol}:`, error);
    return null;
  }
}

// Function to calculate all pairwise correlations
function calculateAllCorrelations(
  symbolsData: SymbolPriceData[]
): CorrelationResult[] {
  const correlations: CorrelationResult[] = [];

  for (let i = 0; i < symbolsData.length; i++) {
    for (let j = i + 1; j < symbolsData.length; j++) {
      const symbol1Data = symbolsData[i];
      const symbol2Data = symbolsData[j];

      // Use the minimum length to ensure same data points
      const minLength = Math.min(
        symbol1Data.prices.length,
        symbol2Data.prices.length
      );
      const prices1 = symbol1Data.prices.slice(0, minLength);
      const prices2 = symbol2Data.prices.slice(0, minLength);

      const correlation = calculateCorrelation(prices1, prices2);

      correlations.push({
        symbol1: symbol1Data.symbol,
        symbol2: symbol2Data.symbol,
        correlation,
        dataPoints: minLength,
      });
    }
  }

  return correlations;
}

// Function to display correlation matrix
function displayCorrelationMatrix(
  symbolsData: SymbolPriceData[],
  correlations: CorrelationResult[]
) {
  console.log("\n=== Correlation Matrix ===\n");

  const symbols = symbolsData.map((s) => s.symbol);
  const n = symbols.length;

  // Create correlation matrix
  const matrix: number[][] = Array(n)
    .fill(0)
    .map(() => Array(n).fill(0));

  // Fill diagonal with 1s (perfect self-correlation)
  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
  }

  // Fill matrix with correlation values
  correlations.forEach((corr) => {
    const i = symbols.indexOf(corr.symbol1);
    const j = symbols.indexOf(corr.symbol2);
    if (i !== -1 && j !== -1) {
      matrix[i][j] = corr.correlation;
      matrix[j][i] = corr.correlation; // Matrix is symmetric
    }
  });

  // Display header
  console.log(
    "Correlation values range from -1 (perfect negative) to +1 (perfect positive)\n"
  );

  // Display matrix with shortened symbol names for better formatting
  const shortSymbols = symbols.map((s) => s.replace("USDT", ""));

  // Print header row
  process.stdout.write("        ");
  shortSymbols.forEach((symbol) => {
    process.stdout.write(symbol.substring(0, 7).padStart(7));
  });
  console.log();

  // Print matrix rows
  for (let i = 0; i < n; i++) {
    process.stdout.write(shortSymbols[i].padEnd(8));
    for (let j = 0; j < n; j++) {
      const value = matrix[i][j].toFixed(2);
      process.stdout.write(value.padStart(7));
    }
    console.log();
  }
}

// Function to display Bitcoin diversification opportunities
function displayBitcoinDiversification(
  correlations: CorrelationResult[],
  symbolsData: SymbolPriceData[]
) {
  console.log("\n=== Bitcoin Diversification Opportunities ===\n");

  // Find Bitcoin correlations
  const bitcoinCorrelations = correlations.filter(
    (corr) => corr.symbol1 === "BTCUSDT" || corr.symbol2 === "BTCUSDT"
  );

  // Get correlations less than 0.9 with Bitcoin (expanded for ~30+ options)
  const lowCorrelationWithBTC = bitcoinCorrelations
    .filter((corr) => Math.abs(corr.correlation) < 0.9)
    .map((corr) => ({
      symbol: corr.symbol1 === "BTCUSDT" ? corr.symbol2 : corr.symbol1,
      correlation: corr.correlation,
      dataPoints: corr.dataPoints,
    }))
    .sort((a, b) => Math.abs(a.correlation) - Math.abs(b.correlation));

  if (lowCorrelationWithBTC.length > 0) {
    console.log(
      "🎯 CRYPTOCURRENCIES WITH DIVERSIFICATION POTENTIAL (<0.9 correlation to Bitcoin):"
    );
    console.log(
      "💡 These assets may provide portfolio diversification benefits\n"
    );

    console.log(
      "┌─────────────────┬─────────────┬─────────────┬─────────────────────────┐"
    );
    console.log(
      "│ Symbol          │ Correlation │ Data Points │ Diversification Level   │"
    );
    console.log(
      "├─────────────────┼─────────────┼─────────────┼─────────────────────────┤"
    );

    lowCorrelationWithBTC.forEach((item) => {
      const symbol = item.symbol.padEnd(15);
      const correlation = item.correlation.toFixed(3).padStart(11);
      const dataPoints = item.dataPoints.toString().padStart(11);

      let diversificationLevel = "";
      const absCorr = Math.abs(item.correlation);
      if (absCorr < 0.3) {
        diversificationLevel = "🟢 Excellent";
      } else if (absCorr < 0.5) {
        diversificationLevel = "🟡 Very Good";
      } else if (absCorr < 0.65) {
        diversificationLevel = "🟠 Good";
      } else if (absCorr < 0.75) {
        diversificationLevel = "🔵 Moderate";
      } else if (absCorr < 0.85) {
        diversificationLevel = "🟣 Limited";
      } else {
        diversificationLevel = "⚪ Minimal";
      }
      diversificationLevel = diversificationLevel.padEnd(23);

      console.log(
        `│ ${symbol} │ ${correlation} │ ${dataPoints} │ ${diversificationLevel} │`
      );
    });

    console.log(
      "└─────────────────┴─────────────┴─────────────┴─────────────────────────┘"
    );

    console.log(`\n📊 DIVERSIFICATION SUMMARY:`);
    console.log(
      `   • Total diversification candidates found: ${lowCorrelationWithBTC.length}`
    );

    const excellentDiversifiers = lowCorrelationWithBTC.filter(
      (c) => Math.abs(c.correlation) < 0.3
    );
    const veryGoodDiversifiers = lowCorrelationWithBTC.filter(
      (c) => Math.abs(c.correlation) >= 0.3 && Math.abs(c.correlation) < 0.5
    );
    const goodDiversifiers = lowCorrelationWithBTC.filter(
      (c) => Math.abs(c.correlation) >= 0.5 && Math.abs(c.correlation) < 0.65
    );
    const moderateDiversifiers = lowCorrelationWithBTC.filter(
      (c) => Math.abs(c.correlation) >= 0.65 && Math.abs(c.correlation) < 0.75
    );
    const limitedDiversifiers = lowCorrelationWithBTC.filter(
      (c) => Math.abs(c.correlation) >= 0.75 && Math.abs(c.correlation) < 0.85
    );
    const minimalDiversifiers = lowCorrelationWithBTC.filter(
      (c) => Math.abs(c.correlation) >= 0.85
    );

    console.log(
      `   • 🟢 Excellent diversifiers (|r| < 0.3): ${excellentDiversifiers.length}`
    );
    console.log(
      `   • 🟡 Very Good diversifiers (0.3 ≤ |r| < 0.5): ${veryGoodDiversifiers.length}`
    );
    console.log(
      `   • 🟠 Good diversifiers (0.5 ≤ |r| < 0.65): ${goodDiversifiers.length}`
    );
    console.log(
      `   • 🔵 Moderate diversifiers (0.65 ≤ |r| < 0.75): ${moderateDiversifiers.length}`
    );
    console.log(
      `   • 🟣 Limited diversifiers (0.75 ≤ |r| < 0.85): ${limitedDiversifiers.length}`
    );
    console.log(
      `   • ⚪ Minimal diversifiers (0.85 ≤ |r| < 0.9): ${minimalDiversifiers.length}`
    );

    if (excellentDiversifiers.length > 0) {
      console.log(`\n🎯 TOP DIVERSIFIERS:`);
      excellentDiversifiers.slice(0, 3).forEach((asset, index) => {
        console.log(
          `   ${index + 1}. ${asset.symbol}: ${asset.correlation.toFixed(
            3
          )} correlation`
        );
      });
    }
  } else {
    console.log(
      "❌ No cryptocurrencies found with correlation < 0.9 to Bitcoin"
    );
    console.log(
      "💡 This suggests extreme Bitcoin dominance in market movements"
    );
    console.log(
      "💡 Consider longer time periods or different intervals for diversification opportunities"
    );
  }
}

// Function to display top correlations
function displayTopCorrelations(
  correlations: CorrelationResult[],
  interval: string,
  symbolsData: SymbolPriceData[]
) {
  console.log("\n=== Top Correlations Analysis ===\n");

  // Sort by absolute correlation value (strongest correlations first)
  const sortedCorrelations = [...correlations].sort(
    (a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)
  );

  console.log("🔗 STRONGEST POSITIVE CORRELATIONS:");
  const topPositive = sortedCorrelations
    .filter((c) => c.correlation > 0)
    .slice(0, 10);

  console.log(
    "┌─────────────────┬─────────────────┬─────────────┬─────────────┐"
  );
  console.log(
    "│ Symbol 1        │ Symbol 2        │ Correlation │ Data Points │"
  );
  console.log(
    "├─────────────────┼─────────────────┼─────────────┼─────────────┤"
  );

  topPositive.forEach((corr) => {
    const symbol1 = corr.symbol1.padEnd(15);
    const symbol2 = corr.symbol2.padEnd(15);
    const correlation = corr.correlation.toFixed(3).padStart(11);
    const dataPoints = corr.dataPoints.toString().padStart(11);

    console.log(`│ ${symbol1} │ ${symbol2} │ ${correlation} │ ${dataPoints} │`);
  });

  console.log(
    "└─────────────────┴─────────────────┴─────────────┴─────────────┘"
  );

  console.log("\n📉 STRONGEST NEGATIVE CORRELATIONS:");
  const topNegative = sortedCorrelations
    .filter((c) => c.correlation < 0)
    .slice(0, 5);

  if (topNegative.length > 0) {
    console.log(
      "┌─────────────────┬─────────────────┬─────────────┬─────────────┐"
    );
    console.log(
      "│ Symbol 1        │ Symbol 2        │ Correlation │ Data Points │"
    );
    console.log(
      "├─────────────────┼─────────────────┼─────────────┼─────────────┤"
    );

    topNegative.forEach((corr) => {
      const symbol1 = corr.symbol1.padEnd(15);
      const symbol2 = corr.symbol2.padEnd(15);
      const correlation = corr.correlation.toFixed(3).padStart(11);
      const dataPoints = corr.dataPoints.toString().padStart(11);

      console.log(
        `│ ${symbol1} │ ${symbol2} │ ${correlation} │ ${dataPoints} │`
      );
    });

    console.log(
      "└─────────────────┴─────────────────┴─────────────┴─────────────┘"
    );
  } else {
    console.log("   No significant negative correlations found.\n");
  }

  // Statistics
  const avgCorrelation =
    correlations.reduce((sum, c) => sum + Math.abs(c.correlation), 0) /
    correlations.length;
  const maxCorrelation = Math.max(...correlations.map((c) => c.correlation));
  const minCorrelation = Math.min(...correlations.map((c) => c.correlation));

  console.log(`\n📊 STATISTICS:`);
  console.log(`   • Total correlation pairs analyzed: ${correlations.length}`);
  console.log(
    `   • Average absolute correlation: ${avgCorrelation.toFixed(3)}`
  );
  console.log(
    `   • Highest positive correlation: ${maxCorrelation.toFixed(3)}`
  );
  console.log(`   • Lowest negative correlation: ${minCorrelation.toFixed(3)}`);

  const strongCorrelations = correlations.filter(
    (c) => Math.abs(c.correlation) > 0.7
  );
  console.log(
    `   • Strong correlations (|r| > 0.7): ${strongCorrelations.length}`
  );

  // Calculate time coverage
  const intervalHours: { [key: string]: number } = {
    "1m": 1 / 60,
    "3m": 3 / 60,
    "5m": 5 / 60,
    "15m": 15 / 60,
    "30m": 30 / 60,
    "1h": 1,
    "2h": 2,
    "4h": 4,
    "6h": 6,
    "8h": 8,
    "12h": 12,
    "1d": 24,
    "3d": 72,
    "1w": 168,
    "1M": 720,
  };

  if (correlations.length > 0) {
    const avgDataPoints =
      correlations.reduce((sum, c) => sum + c.dataPoints, 0) /
      correlations.length;
    const hours = intervalHours[interval] || 1;
    const days = Math.round((avgDataPoints * hours) / 24);

    console.log(
      `   • Average time coverage: ~${days} days (${avgDataPoints.toFixed(
        0
      )} × ${interval} intervals)`
    );
  }
}

async function calculateSampleCorrelation() {
  try {
    // Get interval and limit from command line arguments
    const interval = process.argv[2] || "1h";
    const limit = parseInt(process.argv[3]) || 100;

    console.log("🚀 Starting Sample Cryptocurrency Correlation Analysis...\n");
    console.log(`📊 Using ${SAMPLE_SYMBOLS.length} popular cryptocurrencies`);
    console.log(
      `📊 Using Binance Futures API with ${interval} intervals (${limit} data points)\n`
    );

    console.log(
      "🎯 Analyzing popular crypto symbols:",
      SAMPLE_SYMBOLS.join(", ")
    );
    console.log();

    console.log("📈 Fetching price data for each symbol...");
    const symbolsData: SymbolPriceData[] = [];

    // Process symbols sequentially to be gentle on API limits
    for (const symbol of SAMPLE_SYMBOLS) {
      console.log(`   Fetching data for ${symbol}...`);
      const data = await getSymbolPriceData(symbol, interval, limit);

      if (data) {
        symbolsData.push(data);
        console.log(`   ✅ ${symbol}: ${data.dataPoints} data points`);
      } else {
        console.log(`   ❌ ${symbol}: Failed to fetch data`);
      }

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`\n✅ Data collection complete!\n`);
    console.log(
      `📈 Successfully collected data for ${symbolsData.length} symbols`
    );

    if (symbolsData.length < 2) {
      console.log("❌ Need at least 2 symbols to calculate correlations.");
      return;
    }

    console.log(
      `🔄 Calculating correlations between ${symbolsData.length} symbols...`
    );
    const correlations = calculateAllCorrelations(symbolsData);

    console.log(`✅ Calculated ${correlations.length} correlation pairs!\n`);

    // Display results
    displayCorrelationMatrix(symbolsData, correlations);
    displayTopCorrelations(correlations, interval, symbolsData);
    displayBitcoinDiversification(correlations, symbolsData);

    console.log(
      "\n💡 TIP: Try different intervals for different time horizons:"
    );
    console.log(
      "   • npm run corr-sample 1h 500   # Short-term (1h intervals, ~20 days)"
    );
    console.log(
      "   • npm run corr-sample 4h 300   # Medium-term (4h intervals, ~50 days)"
    );
    console.log(
      "   • npm run corr-sample 1d 100   # Long-term (1d intervals, ~100 days)"
    );
  } catch (error) {
    console.error("❌ Error in sample correlation analysis:", error);
  }
}

// Run the analysis
calculateSampleCorrelation().catch(console.error);
