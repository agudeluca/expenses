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

// Function to get all futures symbols
async function getFuturesSymbols(): Promise<string[]> {
  try {
    const exchangeInfo = await binance.futuresExchangeInfo();
    return exchangeInfo.symbols
      .filter((symbol: any) => symbol.status === "TRADING")
      .map((symbol: any) => symbol.symbol);
  } catch (error) {
    console.error("Error fetching exchange info:", error);
    return [];
  }
}

// Function to get kline data for a symbol
async function getKlineData(
  symbol: string,
  interval: string = "12h"
): Promise<KlineData[]> {
  try {
    // Use the correct API call format that works - just symbol and interval
    const data = await binance.futuresCandles(symbol, interval);

    // Check if data is an array, if not, log the response for debugging
    if (!Array.isArray(data)) {
      console.log(
        `Unexpected response format for ${symbol}:`,
        typeof data,
        data
      );
      return [];
    }

    // Return all available data - Binance typically returns up to 500 candles by default
    return data.map((kline: any) => ({
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
    const klineData = await getKlineData(symbol, interval);

    if (klineData.length === 0) {
      return null;
    }

    // Only include symbols with at least 400 data points (out of max 500 from API)
    // This ensures we have substantial data while being realistic about API limits
    if (klineData.length < 400) {
      return null;
    }

    // Use closing prices for CV calculation
    const closingPrices = klineData.map((kline) => parseFloat(kline.close));
    const { cv, mean, stdDev } = calculateCoefficientOfVariation(closingPrices);

    return {
      symbol,
      coefficientOfVariation: cv,
      dataPoints: klineData.length,
      mean,
      standardDeviation: stdDev,
    };
  } catch (error) {
    console.error(`Error processing symbol ${symbol}:`, error);
    return null;
  }
}

// Function to display results in a table
function displayResults(results: CoefficientResult[], interval: string) {
  // Calculate time periods based on interval
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
    return { hours, days };
  };

  const maxPeriod = getTimePeriod(interval, 500);
  const minPeriod = getTimePeriod(interval, 400);

  console.log("\n=== Coefficient of Variation Analysis ===\n");
  console.log(`Analysis based on ${interval} candlestick closing prices`);
  console.log(
    "📊 Showing symbols with substantial data (≥400 out of max 500 data points)\n"
  );

  if (results.length === 0) {
    console.log("❌ No symbols found with sufficient data points.");
    console.log(
      `💡 Note: Binance API returns max 500 data points (~${maxPeriod.days} days with ${interval} intervals)`
    );
    console.log(
      `💡 We require ≥400 data points to ensure data quality (~${minPeriod.days} days)`
    );
    return;
  }

  // Sort by coefficient of variation (descending)
  results.sort((a, b) => b.coefficientOfVariation - a.coefficientOfVariation);

  console.log(`Found ${results.length} symbols with sufficient data:\n`);
  displayTable(results, interval);
}

function displayTable(results: CoefficientResult[], interval: string) {
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
  results.forEach((result, index) => {
    const symbol = result.symbol.padEnd(15);
    const dataPoints = result.dataPoints.toString().padStart(12);
    const mean = result.mean.toFixed(4).padStart(11);
    const stdDev = result.standardDeviation.toFixed(4).padStart(15);
    const cv = result.coefficientOfVariation.toFixed(2).padStart(16) + "%";

    console.log(`│ ${symbol} │ ${dataPoints} │ ${mean} │ ${stdDev} │ ${cv} │`);
  });

  console.log(
    "└─────────────────┴──────────────┴─────────────┴─────────────────┴───────────────────┘"
  );

  if (results.length > 0) {
    const avgDataPoints =
      results.reduce((sum, r) => sum + r.dataPoints, 0) / results.length;
    const avgCV =
      results.reduce((sum, r) => sum + r.coefficientOfVariation, 0) /
      results.length;
    const minDataPoints = Math.min(...results.map((r) => r.dataPoints));
    const maxDataPoints = Math.max(...results.map((r) => r.dataPoints));

    console.log(`\n📊 STATISTICS:`);
    console.log(`   • Total symbols with substantial data: ${results.length}`);
    console.log(
      `   • Average data points per symbol: ${avgDataPoints.toFixed(1)}`
    );
    console.log(`   • Data points range: ${minDataPoints} - ${maxDataPoints}`);
    console.log(`   • Average Coefficient of Variation: ${avgCV.toFixed(2)}%`);

    // Show top 3 most volatile
    console.log("\n🔥 TOP 3 MOST VOLATILE:");
    results.slice(0, 3).forEach((result, index) => {
      console.log(
        `   ${index + 1}. ${
          result.symbol
        }: ${result.coefficientOfVariation.toFixed(2)}% CV (${
          result.dataPoints
        } data points)`
      );
    });

    // Show top 3 least volatile if we have enough results
    if (results.length >= 3) {
      console.log("\n🛡️  TOP 3 LEAST VOLATILE:");
      results
        .slice(-3)
        .reverse()
        .forEach((result, index) => {
          console.log(
            `   ${index + 1}. ${
              result.symbol
            }: ${result.coefficientOfVariation.toFixed(2)}% CV (${
              result.dataPoints
            } data points)`
          );
        });
    }
  }
}

async function calculateCV() {
  try {
    // Get interval from command line arguments, default to 12h
    const interval = process.argv[2] || "12h";

    console.log("🚀 Starting Coefficient of Variation Analysis...\n");
    console.log(`📊 Using Binance Futures API with ${interval} intervals...`);
    console.log(
      "🎯 Looking for symbols with substantial data (≥400 out of 500 max points)\n"
    );
    console.log("📈 Fetching futures symbols from Binance...");

    const symbols = await getFuturesSymbols();
    console.log(`✅ Found ${symbols.length} trading symbols\n`);

    console.log(
      `📈 Analyzing each symbol for data availability and calculating CV (${interval} intervals)...`
    );
    console.log("⏱️  This may take a few minutes due to API rate limits...\n");

    const results: CoefficientResult[] = [];

    // Process symbols in batches to be more conservative with API limits
    const batchSize = 8;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const batchPromises = batch.map((symbol) =>
        processSymbol(symbol, interval)
      );
      const batchResults = await Promise.all(batchPromises);

      // Filter out null results and add to main results
      const validResults = batchResults.filter(
        (result) => result !== null
      ) as CoefficientResult[];
      results.push(...validResults);

      const processed = Math.min(i + batchSize, symbols.length);
      const percentage = ((processed / symbols.length) * 100).toFixed(1);
      const symbolsWithData = validResults.length;
      const totalFound = results.length;
      console.log(
        `📊 Processed ${processed}/${symbols.length} symbols (${percentage}%) - Found ${symbolsWithData} new symbols with sufficient data (total: ${totalFound})`
      );

      // Add delay between batches to respect rate limits
      if (i + batchSize < symbols.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log("\n✅ Analysis complete!\n");
    console.log(
      `📈 Successfully found ${results.length} symbols with substantial data using ${interval} intervals`
    );
    displayResults(results, interval);
  } catch (error) {
    console.error("❌ Error in main function:", error);
  }
}

// Run the analysis
calculateCV().catch(console.error);
