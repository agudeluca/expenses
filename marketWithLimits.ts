
import { Side } from './types';
import { BigNumber } from 'bignumber.js';
import 'dotenv/config';
import { futuresCancel, getMarkPrice, getOrderBook, getPriceInOrderBook, getSymbolExchangeInfo, createLimitOrder, checkOrderExecution } from './api';

interface MarketWithLimit {
  symbol: string;
  quantity: number;
  side: Side;
  isCoin: boolean;
}

const marketWithlimit = async ({
  symbol,
  quantity,
  side,
  isCoin = false,
}: MarketWithLimit) => {
  const [markPrice, exchangeInfo] = await Promise.all([getMarkPrice(symbol), getSymbolExchangeInfo(symbol), getOrderBook(symbol)]);
  let remainingQuantity = isCoin ? Number((quantity).toFixed(exchangeInfo?.quantityPrecision)) : Number((quantity / markPrice.markPrice).toFixed(exchangeInfo?.quantityPrecision));

  while (remainingQuantity > 0) {
    const orderBook = await getOrderBook(symbol);
    if (!orderBook) return;
    const price = getPriceInOrderBook(orderBook, remainingQuantity, side);
    const orderId: BigNumber | number = await createLimitOrder(symbol, price, remainingQuantity, side);
    console.log(orderId)
    if (!orderId) {
      continue;
    }

    const orderIdString = typeof orderId === 'number' ? String(orderId) : orderId.integerValue().toString();

    await new Promise((resolve) => setTimeout(resolve, 5000));
    const orderStatus = await checkOrderExecution(symbol, orderIdString);

    if (!orderStatus) {
      return;
    }

    if (orderStatus.status === 'FILLED') {
      console.log('FILLED');
      remainingQuantity -= Number((quantity / markPrice.markPrice).toFixed(exchangeInfo?.quantityPrecision));
      return
    } else if (orderStatus.status === 'PARTIALLY_FILLED') {
      console.log('PARTIALLY FILLED');
      remainingQuantity -= parseFloat(orderStatus.executedQty);
    } else {
      await futuresCancel(symbol, orderStatus.clientOrderId);
    }
  }
};

export default marketWithlimit;
