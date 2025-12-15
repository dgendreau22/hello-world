/**
 * Polymarket SDK Type Definitions
 */

export interface PolymarketConfig {
  privateKey: string;
  funderAddress: string;
  chainId: number;
  clobHost: string;
  gammaHost: string;
}

export interface Market {
  id: string;
  question: string;
  outcomes: string[];
  outcomePrices: string[];
  volume: string;
  liquidity: string;
  active: boolean;
  closed: boolean;
  conditionId: string;
  slug: string;
}

export interface OrderBook {
  market: string;
  asset_id: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  timestamp: string;
}

export interface OrderBookEntry {
  price: string;
  size: string;
}

export interface Order {
  id: string;
  market: string;
  asset_id: string;
  side: "BUY" | "SELL";
  price: string;
  size: string;
  status: OrderStatus;
  created_at: string;
}

export type OrderStatus = "LIVE" | "MATCHED" | "CANCELLED";

export interface Position {
  asset_id: string;
  market: string;
  size: string;
  avgPrice: string;
  side: "YES" | "NO";
}

export interface TradeSignal {
  market: string;
  asset_id: string;
  action: "BUY" | "SELL";
  side: "YES" | "NO";
  price: string;
  size: string;
  reason: string;
}

export interface ArbitrageOpportunity {
  markets: string[];
  spread: number;
  expectedProfit: number;
  signals: TradeSignal[];
}

export interface MarketMakerConfig {
  spread: number; // Target spread (e.g., 0.02 for 2%)
  orderSize: string; // Size per order in USDC
  maxPosition: string; // Maximum position size
  minLiquidity: string; // Minimum liquidity threshold
  refreshInterval: number; // Milliseconds between order refreshes
}

export interface ArbitrageConfig {
  minSpread: number; // Minimum spread to trigger arbitrage
  maxSlippage: number; // Maximum allowed slippage
  orderSize: string; // Size per arbitrage trade
}
