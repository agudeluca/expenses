import marketWithlimit from "./marketWithLimits";
import { Side } from "./types";

async function main() {
  const [symbol, quantity, side, isCoin] = process.argv.slice(2);

  if (symbol && quantity && side) {
    await marketWithlimit({
      symbol,
      quantity: parseFloat(quantity),
      side: side as Side,
      isCoin: isCoin === "true",
    });
  } else {
    console.log("Usage: npm start <symbol> <quantity> <side> <isCoin>");
    console.log("Example: npm start BTCUSDT 0.001 buy false");
    console.log("For CV analysis, run: npm run cv-analysis");
  }
}

main();
