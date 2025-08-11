import Binance from "node-binance-api";
import { ExchangeInfo, Order, OrderBook, Side } from "../types";
import "dotenv/config";

const binance = new Binance().options({
  APIKEY: process.env.API_KEY,
  APISECRET: process.env.API_SECRET,
});

const getSymbolExchangeInfo = async (symbol: string) => {
  try {
    const info: ExchangeInfo = await binance.futuresExchangeInfo();
    return info?.symbols.find((each) => each.symbol == symbol);
  } catch (error) {
    console.error("Error getting the exchange info:", error);
  }
};

const getMarkPrice = async (symbol: string) => {
  try {
    const price = await binance.futuresMarkPrice(symbol);
    return price;
  } catch (error) {
    console.error("Error getting the mark price:", error);
  }
};

const futuresPositionRisk = async (symbol: string) => {
  try {
    const account = await binance.futuresPositionRisk({ symbol });
    return account[0];
  } catch (error) {
    console.error("Error getting the account:", error);
  }
};

const getOrderBook = async (symbol: string) => {
  try {
    const book: OrderBook = await binance.futuresDepth(symbol, { limit: 100 });
    return book;
  } catch (error) {
    console.error("Error getting the order book:", error);
  }
};

const createLimitOrder = async (
  symbol: string,
  price: number,
  quantity: number,
  side: Side
) => {
  console.log("Creating order...", side);
  let order;
  try {
    if (side === "buy") {
      order = await binance.futuresBuy(symbol, quantity, price);
    } else {
      order = await binance.futuresSell(symbol, quantity, price);
    }
    //console.log('order data', order)
    if (order.code === -5022) {
      console.log("code -5022");
      return null;
    }
    return order.orderId;
  } catch (error: any) {
    console.error("Error creating the limit order:", error.body);
    return null;
  }
};

const getAmountOfOrdersBySymbol = async (
  symbol: string
): Promise<number | undefined> => {
  try {
    const orders: Order[] = await binance.futuresOpenOrders(symbol);
    return orders.length;
  } catch (error) {
    console.error("Error checking order status:", error);
  }
};

const checkOrderById = async (
  symbol: string,
  orderId: string
): Promise<Order | null | undefined> => {
  try {
    const orders: Order[] = await binance.futuresAllOrders(symbol, { orderId });
    console.log(orders.length, "orders");
    return orders.length ? orders[0] : null;
  } catch (error) {
    console.error("Error checking order status:", error);
  }
};

const getPriceInOrderBook = (
  orderBook: OrderBook,
  quantity: number,
  side: Side
) => {
  const orders = side === "buy" ? orderBook.bids : orderBook.asks;
  let cumulativeQuantity = 0;
  let price = 0;

  for (const [orderPrice, orderQuantity] of orders) {
    cumulativeQuantity += parseFloat(orderQuantity);
    if (cumulativeQuantity >= quantity) {
      price = parseFloat(orderPrice);
      break;
    }
  }

  return price;
};

const futuresCancel = async (
  symbol: string,
  origClientOrderId: string
): Promise<Order | null | undefined> => {
  try {
    const order = await binance.futuresCancel(symbol, { origClientOrderId });
    if (order.code === -2011) {
      return null;
    }
    return order;
  } catch (error) {
    console.error("Error checking order status:", error);
  }
};

export {
  getAmountOfOrdersBySymbol,
  getMarkPrice,
  getSymbolExchangeInfo,
  getOrderBook,
  createLimitOrder,
  checkOrderById,
  getPriceInOrderBook,
  futuresCancel,
  futuresPositionRisk,
};
