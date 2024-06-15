import type { OrderType_LT } from './order'

export type RateLimitType_LT = 'REQUEST_WEIGHT' | 'ORDERS'
export type RateLimitInterval_LT = 'SECOND' | 'MINUTE' | 'DAY'

export const enum SymbolFilterType {
  PRICE_FILTER = 'PRICE_FILTER',
  PERCENT_PRICE = 'PERCENT_PRICE',
  LOT_SIZE = 'LOT_SIZE',
  MARKET_LOT_SIZE = 'MARKET_LOT_SIZE',
  MIN_NOTIONAL = 'MIN_NOTIONAL',
  MAX_NUM_ORDERS = 'MAX_NUM_ORDERS',
  MAX_ALGO_ORDERS = 'MAX_ALGO_ORDERS'
}

export type SymbolPriceFilter = {
  filterType: SymbolFilterType.PRICE_FILTER
  minPrice: string
  notional: string
  maxPrice: string
  tickSize: string
}

export type SymbolPercentPriceFilter = {
  filterType: SymbolFilterType.PERCENT_PRICE
  multiplierDown: string
  multiplierUp: string
  multiplierDecimal: number
}

export type SymbolLotSizeFilter = {
  filterType: SymbolFilterType.LOT_SIZE
  minQty: string
  maxQty: string
  stepSize: string
}

export type SymbolMarketLotSizeFilter = {
  filterType: SymbolFilterType.MARKET_LOT_SIZE
  minQty: string
  maxQty: string
  stepSize: string
}

export type SymbolMinNotionalFilter = {
  filterType: SymbolFilterType.MIN_NOTIONAL
  notional: string
}

export type SymbolMaxNumOrdersFilter = {
  filterType: SymbolFilterType.MAX_NUM_ORDERS
  maxNumOrders: number
}

export type SymbolMaxAlgoOrdersFilter = {
  filterType: SymbolFilterType.MAX_ALGO_ORDERS
  maxNumAlgoOrders: number
}

export type SymbolFilter =
  | SymbolPriceFilter
  | SymbolPercentPriceFilter
  | SymbolLotSizeFilter
  | SymbolMarketLotSizeFilter
  | SymbolMinNotionalFilter
  | SymbolMaxNumOrdersFilter
  | SymbolMaxAlgoOrdersFilter

export type SymbolFilterType_LT =
  | 'PRICE_FILTER'
  | 'PERCENT_PRICE'
  | 'LOT_SIZE'
  | 'MIN_NOTIONAL'
  | 'MAX_NUM_ORDERS'
  | 'MAX_ALGO_ORDERS'

export type TradingType_LT = 'MARGIN' | 'SPOT'

export type PairSymbol = {
  baseAsset: string
  baseAssetPrecision: number
  baseCommissionPrecision: number
  filters: SymbolFilter[]
  icebergAllowed: boolean
  isMarginTradingAllowed: boolean
  isSpotTradingAllowed: boolean
  ocoAllowed: boolean
  orderTypes: OrderType_LT[]
  permissions: TradingType_LT[]
  quoteAsset: string
  quoteAssetPrecision: number
  quantityPrecision: number
  pricePrecision: number
  quoteCommissionPrecision: number
  quoteOrderQtyMarketAllowed: boolean
  quotePrecision: number
  status: string
  symbol: string
}

export type ExchangeInfoRateLimit = {
  rateLimitType: RateLimitType_LT
  interval: RateLimitInterval_LT
  intervalNum: number
  limit: number
}
export type ExchangeFilter = {
  filterType: ExchangeFilterType_LT
  limit: number
}
export type ExchangeFilterType_LT = 'EXCHANGE_MAX_NUM_ORDERS' | 'EXCHANGE_MAX_ALGO_ORDERS'

export type ExchangeInfo = {
  timezone: string
  serverTime: number
  rateLimits: ExchangeInfoRateLimit[]
  exchangeFilters: ExchangeFilter[]
  symbols: PairSymbol[]
}

export type ExchangeDataResponse = {
  pricePrecision: number
  quantityPrecision: number
  minPrice: number
  minNotional: string
}

export type OrderBook = {
  lastUpdateId: number
  E: number
  T: number
  bids: [string, string][]
  asks: [string, string][]
}

export type Side = 'buy' | 'sell'
/*
{
  orderId: BigNumber { s: 1, e: 18, c: [ 83897, 65691490622239 ] },
  symbol: 'ETHUSDT',
  status: 'NEW',
  clientOrderId: 'iq40pFbOC3MrdAl6MlZ7qY',
  price: '3562.59',
  avgPrice: '0.00000',
  origQty: '0.008',
  executedQty: '0',
  cumQuote: '0',
  timeInForce: 'GTX',
  type: 'LIMIT',
  reduceOnly: false,
  closePosition: false,
  side: 'SELL',
  positionSide: 'BOTH',
  stopPrice: '0',
  workingType: 'CONTRACT_PRICE',
  priceMatch: 'NONE',
  selfTradePreventionMode: 'NONE',
  goodTillDate: 0,
  priceProtect: false,
  origType: 'LIMIT',
  time: 1718477837911,
  updateTime: 1718477837911
} */

export type Order = {
  orderId: string
  symbol: string
  status: string
  clientOrderId: string
  price: string
  avgPrice: string
  origQty: string
  executedQty: string
  cumQuote: string
  timeInForce: string
  type: string
  reduceOnly: boolean
  closePosition: boolean
  side: Side
  positionSide: string
  stopPrice: string
  workingType: string
  priceMatch: string
  selfTradePreventionMode: string
  goodTillDate: number
  priceProtect: boolean
  origType: string
  time: number
  updateTime: number
}
