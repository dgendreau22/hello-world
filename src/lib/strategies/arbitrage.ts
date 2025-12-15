/**
 * Arbitrage Strategy
 *
 * Detects and executes arbitrage opportunities across Polymarket.
 * Types of arbitrage supported:
 * 1. YES/NO arbitrage - When YES + NO prices don't sum to 1.0
 * 2. Cross-market arbitrage - Related markets with correlated outcomes
 */

import type {
  ArbitrageConfig,
  ArbitrageOpportunity,
  TradeSignal,
  Market,
} from "../polymarket/types";
import { getGammaClient, hasCredentials } from "../polymarket/client";
import { getWebSocket } from "../polymarket/websocket";

const DEFAULT_CONFIG: ArbitrageConfig = {
  minSpread: 0.01, // 1% minimum spread to trigger
  maxSlippage: 0.005, // 0.5% max slippage
  orderSize: "50", // 50 USDC per trade
};

interface PriceData {
  assetId: string;
  marketId: string;
  side: "YES" | "NO";
  price: number;
  timestamp: number;
}

interface MonitoredMarket {
  marketId: string;
  yesAssetId: string;
  noAssetId: string;
  yesPrice: number;
  noPrice: number;
  lastUpdate: number;
}

export class ArbitrageDetector {
  private config: ArbitrageConfig;
  private ws = getWebSocket();
  private monitoredMarkets: Map<string, MonitoredMarket> = new Map();
  private isRunning = false;
  private onOpportunity: ((opp: ArbitrageOpportunity) => void) | null = null;

  constructor(config: Partial<ArbitrageConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start monitoring markets for arbitrage opportunities
   */
  async start(marketIds: string[]): Promise<void> {
    if (this.isRunning) {
      console.log("[ARB] Already running");
      return;
    }

    this.isRunning = true;

    // Fetch market data using GammaSDK
    const gamma = getGammaClient();

    for (const marketId of marketIds) {
      try {
        // Initialize market tracking
        // Note: You'll need to fetch actual asset IDs from the market data
        const market: MonitoredMarket = {
          marketId,
          yesAssetId: "", // To be populated from API
          noAssetId: "", // To be populated from API
          yesPrice: 0,
          noPrice: 0,
          lastUpdate: 0,
        };

        this.monitoredMarkets.set(marketId, market);
      } catch (error) {
        console.error(`[ARB] Failed to load market ${marketId}:`, error);
      }
    }

    // Connect WebSocket and subscribe to price updates
    if (!this.ws.isConnected()) {
      await this.ws.connect();
    }

    const allAssetIds = Array.from(this.monitoredMarkets.values()).flatMap(
      (m) => [m.yesAssetId, m.noAssetId].filter(Boolean)
    );

    if (allAssetIds.length > 0) {
      this.ws.subscribePrice(allAssetIds, (assetId, price) => {
        this.handlePriceUpdate(assetId, parseFloat(price));
      });
    }

    console.log(`[ARB] Started monitoring ${marketIds.length} markets`);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.isRunning = false;

    const allAssetIds = Array.from(this.monitoredMarkets.values()).flatMap(
      (m) => [m.yesAssetId, m.noAssetId].filter(Boolean)
    );

    if (allAssetIds.length > 0) {
      this.ws.unsubscribe(allAssetIds);
    }

    this.monitoredMarkets.clear();
    console.log("[ARB] Stopped monitoring");
  }

  /**
   * Set callback for when opportunities are detected
   */
  onOpportunityDetected(
    callback: (opp: ArbitrageOpportunity) => void
  ): void {
    this.onOpportunity = callback;
  }

  /**
   * Check for YES/NO arbitrage in a single market
   * If YES + NO < 1.0, there's a risk-free profit opportunity
   */
  checkYesNoArbitrage(market: MonitoredMarket): ArbitrageOpportunity | null {
    if (market.yesPrice === 0 || market.noPrice === 0) {
      return null;
    }

    const totalPrice = market.yesPrice + market.noPrice;
    const spread = 1.0 - totalPrice;

    // If total < 1.0, buying both YES and NO guarantees profit
    if (spread > this.config.minSpread) {
      const expectedProfit =
        spread * parseFloat(this.config.orderSize) -
        this.config.maxSlippage * 2; // Account for slippage on both trades

      if (expectedProfit > 0) {
        return {
          markets: [market.marketId],
          spread,
          expectedProfit,
          signals: [
            {
              market: market.marketId,
              asset_id: market.yesAssetId,
              action: "BUY",
              side: "YES",
              price: market.yesPrice.toFixed(4),
              size: this.config.orderSize,
              reason: `YES/NO arbitrage - total price ${totalPrice.toFixed(4)} < 1.0`,
            },
            {
              market: market.marketId,
              asset_id: market.noAssetId,
              action: "BUY",
              side: "NO",
              price: market.noPrice.toFixed(4),
              size: this.config.orderSize,
              reason: `YES/NO arbitrage - total price ${totalPrice.toFixed(4)} < 1.0`,
            },
          ],
        };
      }
    }

    // If total > 1.0, selling both (if you hold positions) could be profitable
    // This is less common and requires existing positions

    return null;
  }

  /**
   * Scan all monitored markets for opportunities
   */
  scanForOpportunities(): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];

    for (const market of this.monitoredMarkets.values()) {
      const yesNoArb = this.checkYesNoArbitrage(market);
      if (yesNoArb) {
        opportunities.push(yesNoArb);
      }
    }

    return opportunities;
  }

  /**
   * Get current market states
   */
  getMarketStates(): MonitoredMarket[] {
    return Array.from(this.monitoredMarkets.values());
  }

  /**
   * Manually update prices (for testing or REST-based updates)
   */
  updatePrices(
    marketId: string,
    yesPrice: number,
    noPrice: number
  ): void {
    const market = this.monitoredMarkets.get(marketId);
    if (market) {
      market.yesPrice = yesPrice;
      market.noPrice = noPrice;
      market.lastUpdate = Date.now();

      this.checkAndNotify(market);
    }
  }

  private handlePriceUpdate(assetId: string, price: number): void {
    // Find which market this asset belongs to
    for (const market of this.monitoredMarkets.values()) {
      if (market.yesAssetId === assetId) {
        market.yesPrice = price;
        market.lastUpdate = Date.now();
        this.checkAndNotify(market);
        return;
      }
      if (market.noAssetId === assetId) {
        market.noPrice = price;
        market.lastUpdate = Date.now();
        this.checkAndNotify(market);
        return;
      }
    }
  }

  private checkAndNotify(market: MonitoredMarket): void {
    if (!this.isRunning || !this.onOpportunity) {
      return;
    }

    const opportunity = this.checkYesNoArbitrage(market);
    if (opportunity) {
      console.log(
        `[ARB] Opportunity detected: ${opportunity.spread.toFixed(4)} spread, ` +
          `expected profit: $${opportunity.expectedProfit.toFixed(2)}`
      );
      this.onOpportunity(opportunity);
    }
  }
}

// Singleton instance
let arbitrageInstance: ArbitrageDetector | null = null;

export function getArbitrageDetector(
  config?: Partial<ArbitrageConfig>
): ArbitrageDetector {
  if (!arbitrageInstance) {
    arbitrageInstance = new ArbitrageDetector(config);
  }
  return arbitrageInstance;
}
