/**
 * Market Making Strategy
 *
 * Provides liquidity by placing bid/ask orders around the market price.
 * Profits from the spread between buy and sell prices.
 */

import type {
  OrderBook,
  MarketMakerConfig,
  TradeSignal,
  Order,
} from "../polymarket/types";
import { getWebSocket } from "../polymarket/websocket";
import { getGammaClient, getClobClient, hasCredentials } from "../polymarket/client";

const DEFAULT_CONFIG: MarketMakerConfig = {
  spread: 0.02, // 2% spread
  orderSize: "10", // 10 USDC per order
  maxPosition: "100", // Max 100 USDC position
  minLiquidity: "1000", // Min 1000 USDC liquidity
  refreshInterval: 30000, // 30 seconds
};

interface MarketMakerState {
  assetId: string;
  marketId: string;
  currentBid: Order | null;
  currentAsk: Order | null;
  position: number;
  isRunning: boolean;
}

export class MarketMaker {
  private config: MarketMakerConfig;
  private states: Map<string, MarketMakerState> = new Map();
  private ws = getWebSocket();
  private refreshTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: Partial<MarketMakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start market making for a specific asset
   */
  async start(assetId: string, marketId: string): Promise<void> {
    if (!hasCredentials()) {
      throw new Error("Trading credentials required for market making");
    }

    if (this.states.has(assetId)) {
      console.log(`[MM] Already running for asset ${assetId}`);
      return;
    }

    const state: MarketMakerState = {
      assetId,
      marketId,
      currentBid: null,
      currentAsk: null,
      position: 0,
      isRunning: true,
    };

    this.states.set(assetId, state);

    // Connect to WebSocket if not connected
    if (!this.ws.isConnected()) {
      await this.ws.connect();
    }

    // Subscribe to order book updates
    this.ws.subscribeOrderBook([assetId], (orderBook) => {
      this.handleOrderBookUpdate(assetId, orderBook);
    });

    // Start refresh timer
    const timer = setInterval(() => {
      this.refreshOrders(assetId);
    }, this.config.refreshInterval);

    this.refreshTimers.set(assetId, timer);

    console.log(`[MM] Started market making for asset ${assetId}`);
  }

  /**
   * Stop market making for a specific asset
   */
  async stop(assetId: string): Promise<void> {
    const state = this.states.get(assetId);
    if (!state) {
      return;
    }

    state.isRunning = false;

    // Clear refresh timer
    const timer = this.refreshTimers.get(assetId);
    if (timer) {
      clearInterval(timer);
      this.refreshTimers.delete(assetId);
    }

    // Cancel existing orders
    await this.cancelOrders(assetId);

    // Unsubscribe from updates
    this.ws.unsubscribe([assetId]);

    this.states.delete(assetId);

    console.log(`[MM] Stopped market making for asset ${assetId}`);
  }

  /**
   * Stop all market making
   */
  async stopAll(): Promise<void> {
    const assetIds = Array.from(this.states.keys());
    await Promise.all(assetIds.map((id) => this.stop(id)));
  }

  /**
   * Get current state for an asset
   */
  getState(assetId: string): MarketMakerState | undefined {
    return this.states.get(assetId);
  }

  /**
   * Calculate optimal bid/ask prices based on order book
   */
  calculateQuotes(orderBook: OrderBook): { bid: string; ask: string } | null {
    if (orderBook.bids.length === 0 || orderBook.asks.length === 0) {
      return null;
    }

    const bestBid = parseFloat(orderBook.bids[0].price);
    const bestAsk = parseFloat(orderBook.asks[0].price);
    const midPrice = (bestBid + bestAsk) / 2;

    // Calculate our quotes with target spread
    const halfSpread = this.config.spread / 2;
    const ourBid = midPrice * (1 - halfSpread);
    const ourAsk = midPrice * (1 + halfSpread);

    // Ensure we're inside the current spread for better fill probability
    const finalBid = Math.min(ourBid, bestBid - 0.001);
    const finalAsk = Math.max(ourAsk, bestAsk + 0.001);

    return {
      bid: finalBid.toFixed(4),
      ask: finalAsk.toFixed(4),
    };
  }

  /**
   * Generate trade signals based on current state
   */
  generateSignals(assetId: string, orderBook: OrderBook): TradeSignal[] {
    const state = this.states.get(assetId);
    if (!state || !state.isRunning) {
      return [];
    }

    const quotes = this.calculateQuotes(orderBook);
    if (!quotes) {
      return [];
    }

    const signals: TradeSignal[] = [];
    const maxPosition = parseFloat(this.config.maxPosition);

    // Generate bid signal if we have room to buy
    if (state.position < maxPosition) {
      signals.push({
        market: state.marketId,
        asset_id: assetId,
        action: "BUY",
        side: "YES",
        price: quotes.bid,
        size: this.config.orderSize,
        reason: "Market making - providing bid liquidity",
      });
    }

    // Generate ask signal if we have position to sell
    if (state.position > -maxPosition) {
      signals.push({
        market: state.marketId,
        asset_id: assetId,
        action: "SELL",
        side: "YES",
        price: quotes.ask,
        size: this.config.orderSize,
        reason: "Market making - providing ask liquidity",
      });
    }

    return signals;
  }

  private handleOrderBookUpdate(assetId: string, orderBook: OrderBook): void {
    const state = this.states.get(assetId);
    if (!state || !state.isRunning) {
      return;
    }

    const signals = this.generateSignals(assetId, orderBook);

    // Log signals for monitoring (actual execution would happen here)
    for (const signal of signals) {
      console.log(
        `[MM] Signal: ${signal.action} ${signal.size} @ ${signal.price} - ${signal.reason}`
      );
    }
  }

  private async refreshOrders(assetId: string): Promise<void> {
    const state = this.states.get(assetId);
    if (!state || !state.isRunning) {
      return;
    }

    console.log(`[MM] Refreshing orders for asset ${assetId}`);

    // Cancel existing orders and place new ones
    // This is a placeholder - actual implementation would use getClobClient()
    await this.cancelOrders(assetId);
  }

  private async cancelOrders(assetId: string): Promise<void> {
    const state = this.states.get(assetId);
    if (!state) {
      return;
    }

    // Cancel bid order if exists
    if (state.currentBid) {
      console.log(`[MM] Cancelling bid order ${state.currentBid.id}`);
      // getClobClient().cancelOrder(state.currentBid.id);
      state.currentBid = null;
    }

    // Cancel ask order if exists
    if (state.currentAsk) {
      console.log(`[MM] Cancelling ask order ${state.currentAsk.id}`);
      // getClobClient().cancelOrder(state.currentAsk.id);
      state.currentAsk = null;
    }
  }
}

// Singleton instance
let marketMakerInstance: MarketMaker | null = null;

export function getMarketMaker(
  config?: Partial<MarketMakerConfig>
): MarketMaker {
  if (!marketMakerInstance) {
    marketMakerInstance = new MarketMaker(config);
  }
  return marketMakerInstance;
}
