
import { Side } from './types';
import { BigNumber } from 'bignumber.js';
import 'dotenv/config';
import { futuresCancel, getMarkPrice, getOrderBook, getPriceInOrderBook, getSymbolExchangeInfo, createLimitOrder, checkOrderExecution } from './api';

interface MarketWithLimit {
  symbol: string;
  quantity: number;
  side: Side;
  usdt: boolean;
}

const marketWithlimit = async ({
  symbol,
  quantity,
  side,
  usdt = false,
}: MarketWithLimit) => {
  console.log('limitOrderFlow');
  const [markPrice, exchangeInfo] = await Promise.all([getMarkPrice(symbol), getSymbolExchangeInfo(symbol), getOrderBook(symbol)]);
  let remainingQuantity = usdt ? Number((quantity / markPrice.markPrice).toFixed(exchangeInfo?.quantityPrecision)) : quantity;

  while (remainingQuantity > 0) {
    const orderBook = await getOrderBook(symbol);
    if (!orderBook) return;
    const price = getPriceInOrderBook(orderBook, remainingQuantity, side);
    const orderId: BigNumber = await createLimitOrder(symbol, price, remainingQuantity, side);

    if (!orderId) {
      continue;
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
    const orderStatus = await checkOrderExecution(symbol, orderId.integerValue().toString());

    if (!orderStatus) {
      return;
    }
    console.log(orderStatus)
    if (orderStatus.status === 'FILLED') {
      console.log('FILLED');
      remainingQuantity -= Number((quantity / markPrice.markPrice).toFixed(exchangeInfo?.quantityPrecision));
    } else if (orderStatus.status === 'PARTIALLY_FILLED') {
      console.log('PARTIALLY FILLED');
      remainingQuantity -= parseFloat(orderStatus.executedQty);
    } else {
      await futuresCancel(symbol, orderStatus.clientOrderId);
    }
  }
};

export default marketWithlimit;
