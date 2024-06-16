import marketWithlimit from './marketWithLimits';
import { Side } from './types';


async function main() {
  const [symbol, quantity, side, isCoin] = process.argv.slice(2)
  await marketWithlimit({
    symbol,
    quantity: Number(quantity),
    side: side as Side,
    isCoin: isCoin === 'coin' ? true : false,
  });
}

main();
