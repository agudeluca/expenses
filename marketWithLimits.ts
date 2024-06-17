
import { Side } from './types';
import { BigNumber } from 'bignumber.js';
import 'dotenv/config';
import { futuresCancel, getMarkPrice, getOrderBook, getPriceInOrderBook, getSymbolExchangeInfo, createLimitOrder, checkOrderById, getAmountOfOrdersBySymbol, futuresPositionRisk } from './api';

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
    console.log('remainingQuantity', remainingQuantity)
    const orderBook = await getOrderBook(symbol);
    if (!orderBook) return;

    // we check the position before firing the order, so we can check if the order was filled
    const positionRiskBefore = await futuresPositionRisk(symbol);
    // we check the amount of orders before firing the order, so we can check if the order was created
    const ordersAmountBefore = await getAmountOfOrdersBySymbol(symbol);


    console.log('ordersAmountBefore first', ordersAmountBefore)
    // we get the price from the order book
    const price = getPriceInOrderBook(orderBook, remainingQuantity, side);

    // we fire the order, and we wait for it to be filled
    const orderId: BigNumber | number = await createLimitOrder(symbol, price, remainingQuantity, side);
    console.log('orderId', orderId)
    if (!orderId) {
      const positionRiskAfter = await futuresPositionRisk(symbol);
      // do we need to check if the position has changed?
      // if the position has changed, we can assume the order was filled
      console.log(positionRiskAfter?.positionAmt, positionRiskBefore?.positionAmt)
      if (positionRiskAfter?.positionAmt !== positionRiskBefore?.positionAmt) {
        console.log('FILLED')
        return;
      }
      // if the position hasn't changed, we can assume the order wasn't created
      // but we need to check if the order was created
      const ordersAmountAfter = await getAmountOfOrdersBySymbol(symbol);

      if (ordersAmountAfter === ordersAmountBefore) {
        console.log('No order created, trying again...')
        continue;
      }
    }
    // wait to be executed
    await new Promise((resolve) => setTimeout(resolve, 5000));


    // we check the order status
    const orderIdString = typeof orderId === 'number' ? String(orderId) : orderId.integerValue().toString();
    const orderStatus = await checkOrderById(symbol, orderIdString);
    console.log('orderStatus', orderStatus)
    if (!orderStatus) {
      console.log('No order status, ERROR')
      return;
    }


    // if the order was filled, we can return
    if (orderStatus.status === 'FILLED') {
      console.log('FILLED');
      remainingQuantity -= Number((quantity / markPrice.markPrice).toFixed(exchangeInfo?.quantityPrecision));
      return
      // if the order was partially filled, we need to check the remaining quantity
    } else if (orderStatus.status === 'PARTIALLY_FILLED') {
      console.log('PARTIALLY FILLED');
      remainingQuantity -= parseFloat(orderStatus.executedQty);
    } else {
      // if the order was not filled, we need to cancel it
      // and repeat the process again
      const canceledOrder = await futuresCancel(symbol, orderStatus.clientOrderId);
      if (canceledOrder) {
        console.log('Order canceled');
        continue;
      }
      console.log('Order not canceled, FILLED');
    }
  }
};

export default marketWithlimit;
