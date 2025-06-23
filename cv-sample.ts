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

interface CoefficientResult {
  symbol: string;
  coefficientOfVariation: number;
  dataPoints: number;
  mean: number;
  standardDeviation: number;
}

// Sample of popular cryptocurrency symbols
const SAMPLE_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "ADAUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "DOTUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
  "MATICUSDT",
  "LINKUSDT",
  "LTCUSDT",
  "UNIUSDT",
  "ATOMUSDT",
  "NEARUSDT",
];

// Function to get kline data for a symbol
async function getKlineData(
  symbol: string,
  interval: string = "12h"
): Promise<KlineData[]> {
  try {
    const data = await binance.futuresCandles(symbol, interval);

    if (!Array.isArray(data)) {
      console.log(`Unexpected response format for ${symbol}:`, typeof data);
      return [];
    }

    // Take the last 100 data points (about 50 days of 12h candles)
    const limitedData = data.slice(-100);

    return limitedData.map((kline: any) => ({
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
  } catch (error) {
    console.error(`Error fetching kline data for ${symbol}:`, error);
    return [];
  }
}

// Function to calculate coefficient of variation
function calculateCoefficientOfVariation(prices: number[]): {
  cv: number;
  mean: number;
  stdDev: number;
} {
  if (prices.length === 0) return { cv: 0, mean: 0, stdDev: 0 };

  const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  const variance =
    prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) /
    prices.length;
  const stdDev = Math.sqrt(variance);
  const cv = (stdDev / mean) * 100; // CV as percentage

  return { cv, mean, stdDev };
}

// Function to process a single symbol
async function processSymbol(
  symbol: string,
  interval: string = "12h"
): Promise<CoefficientResult | null> {
  try {
    console.log(`📊 Processing ${symbol}...`);
    const klineData = await getKlineData(symbol, interval);

    if (klineData.length === 0) {
      console.log(`❌ No data for ${symbol}`);
      return null;
    }

    // Use closing prices for CV calculation
    const closingPrices = klineData.map((kline) => parseFloat(kline.close));
    const { cv, mean, stdDev } = calculateCoefficientOfVariation(closingPrices);

    console.log(
      `✅ ${symbol}: ${cv.toFixed(2)}% CV (${klineData.length} data points)`
    );

    return {
      symbol,
      coefficientOfVariation: cv,
      dataPoints: klineData.length,
      mean,
      standardDeviation: stdDev,
    };
  } catch (error) {
    console.error(`❌ Error processing symbol ${symbol}:`, error);
    return null;
  }
}

// Function to display results in a table
function displayResults(results: CoefficientResult[], interval: string) {
  // Calculate time period for display
  const getTimePeriod = (interval: string, dataPoints: number) => {
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

    const hours = intervalHours[interval] || 12;
    const days = Math.round((dataPoints * hours) / 24);
    return days;
  };

  const demoDays = getTimePeriod(interval, 100);

  console.log("\n" + "=".repeat(80));
  console.log("🚀 CRYPTOCURRENCY COEFFICIENT OF VARIATION ANALYSIS (DEMO) 🚀");
  console.log("=".repeat(80));
  console.log(`📈 Analysis based on ${interval} candlestick closing prices`);
  console.log(
    `📊 Demo version: Using ~100 data points per symbol (~${demoDays} days)`
  );
  console.log(
    "💡 For full analysis with substantial data (≥400 points), run: npm run cv-analysis <interval>\n"
  );

  if (results.length === 0) {
    console.log("❌ No valid data found for any symbols.");
    return;
  }

  // Sort by coefficient of variation (descending - most volatile first)
  results.sort((a, b) => b.coefficientOfVariation - a.coefficientOfVariation);

  // Display table header
  console.log(
    "┌─────────────────┬──────────────┬─────────────┬─────────────────┬───────────────────┐"
  );
  console.log(
    "│ Symbol          │ Data Points  │ Mean Price  │ Std Deviation   │ Coeff. Variation  │"
  );
  console.log(
    "├─────────────────┼──────────────┼─────────────┼─────────────────┼───────────────────┤"
  );

  // Display each result
  results.forEach((result) => {
    const symbol = result.symbol.padEnd(15);
    const dataPoints = result.dataPoints.toString().padStart(12);
    const mean = result.mean.toFixed(2).padStart(11);
    const stdDev = result.standardDeviation.toFixed(2).padStart(15);
    const cv = result.coefficientOfVariation.toFixed(2).padStart(16) + "%";

    console.log(`│ ${symbol} │ ${dataPoints} │ ${mean} │ ${stdDev} │ ${cv} │`);
  });

  console.log(
    "└─────────────────┴──────────────┴─────────────┴─────────────────┴───────────────────┘"
  );

  // Statistics
  const avgCV =
    results.reduce((sum, r) => sum + r.coefficientOfVariation, 0) /
    results.length;
  const avgDataPoints =
    results.reduce((sum, r) => sum + r.dataPoints, 0) / results.length;

  console.log(`\n📈 DEMO SUMMARY:`);
  console.log(`   • Total symbols analyzed: ${results.length}`);
  console.log(
    `   • Average data points per symbol: ${avgDataPoints.toFixed(1)}`
  );
  console.log(`   • Average Coefficient of Variation: ${avgCV.toFixed(2)}%`);
  console.log(`   • Time interval used: ${interval}`);

  // Show top 3 most volatile
  console.log("\n🔥 TOP 3 MOST VOLATILE:");
  results.slice(0, 3).forEach((result, index) => {
    console.log(
      `   ${index + 1}. ${
        result.symbol
      }: ${result.coefficientOfVariation.toFixed(2)}% CV`
    );
  });

  // Show top 3 least volatile
  console.log("\n🛡️  TOP 3 LEAST VOLATILE:");
  results
    .slice(-3)
    .reverse()
    .forEach((result, index) => {
      console.log(
        `   ${index + 1}. ${
          result.symbol
        }: ${result.coefficientOfVariation.toFixed(2)}% CV`
      );
    });

  console.log("\n💡 WHAT IS COEFFICIENT OF VARIATION?");
  console.log("   CV = (Standard Deviation / Mean) × 100");
  console.log(
    "   Higher CV = More volatile (riskier but potentially more profitable)"
  );
  console.log("   Lower CV = More stable (less risky, more predictable)");
  console.log(
    `\n🚀 For complete analysis with substantial data (≥400 points): npm run cv-analysis ${interval}`
  );
  console.log("\n" + "=".repeat(80));
}

async function main() {
  try {
    // Get interval from command line arguments, default to 12h
    const interval = process.argv[2] || "12h";

    // Calculate time period for demo
    const getTimePeriod = (interval: string, dataPoints: number) => {
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

      const hours = intervalHours[interval] || 12;
      const days = Math.round((dataPoints * hours) / 24);
      return days;
    };

    const demoDays = getTimePeriod(interval, 100);

    console.log(
      "🚀 Starting Sample Coefficient of Variation Analysis (DEMO)...\n"
    );
    console.log(
      `📊 Analyzing ${SAMPLE_SYMBOLS.length} popular cryptocurrency futures...`
    );
    console.log(
      `📈 Demo version: ~100 data points per symbol (~${demoDays} days with ${interval} intervals)`
    );
    console.log(
      "💡 For full analysis with substantial data (≥400 points), use: npm run cv-analysis <interval>\n"
    );

    const results: CoefficientResult[] = [];

    // Process symbols one by one to avoid rate limiting
    for (const symbol of SAMPLE_SYMBOLS) {
      const result = await processSymbol(symbol, interval);
      if (result) {
        results.push(result);
      }

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    displayResults(results, interval);
  } catch (error) {
    console.error("❌ Error in main function:", error);
  }
}

// Run the analysis
main().catch(console.error);
