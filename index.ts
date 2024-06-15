import marketWithlimit from './marketWithLimits';
import { Side } from './types';


async function main() {
  const [symbol, quantity, side, usdt] = process.argv.slice(2)
  await marketWithlimit({
    symbol,
    quantity: Number(quantity),
    side: side as Side,
    usdt: usdt === 'false' ? false : true,
  });
}

main();
