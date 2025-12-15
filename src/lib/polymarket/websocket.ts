/**
 * Polymarket WebSocket Manager
 *
 * Handles real-time market data streaming with auto-reconnection.
 * Essential for market making and arbitrage strategies.
 */

import type { OrderBook, OrderBookEntry } from "./types";

type OrderBookCallback = (orderBook: OrderBook) => void;
type PriceCallback = (assetId: string, price: string) => void;
type ErrorCallback = (error: Error) => void;

interface WebSocketConfig {
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface Subscription {
  assetIds: string[];
  onOrderBook?: OrderBookCallback;
  onPrice?: PriceCallback;
}

const DEFAULT_WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";

export class PolymarketWebSocket {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private subscriptions: Map<string, Subscription> = new Map();
  private reconnectAttempts = 0;
  private isConnecting = false;
  private shouldReconnect = true;
  private orderBookCallbacks: Map<string, OrderBookCallback[]> = new Map();
  private priceCallbacks: Map<string, PriceCallback[]> = new Map();
  private onError: ErrorCallback | null = null;

  constructor(config: WebSocketConfig = {}) {
    this.config = {
      url: config.url || DEFAULT_WS_URL,
      reconnectInterval: config.reconnectInterval || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
    };
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.shouldReconnect = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url);

        this.ws.onopen = () => {
          console.log("[WS] Connected to Polymarket");
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.resubscribeAll();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error("[WS] Error:", error);
          this.isConnecting = false;
          if (this.onError) {
            this.onError(new Error("WebSocket error"));
          }
        };

        this.ws.onclose = () => {
          console.log("[WS] Connection closed");
          this.isConnecting = false;
          this.attemptReconnect();
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Subscribe to order book updates for specific assets
   */
  subscribeOrderBook(assetIds: string[], callback: OrderBookCallback): void {
    for (const assetId of assetIds) {
      const callbacks = this.orderBookCallbacks.get(assetId) || [];
      callbacks.push(callback);
      this.orderBookCallbacks.set(assetId, callbacks);
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscription(assetIds, "book");
    }
  }

  /**
   * Subscribe to price updates for specific assets
   */
  subscribePrice(assetIds: string[], callback: PriceCallback): void {
    for (const assetId of assetIds) {
      const callbacks = this.priceCallbacks.get(assetId) || [];
      callbacks.push(callback);
      this.priceCallbacks.set(assetId, callbacks);
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscription(assetIds, "price");
    }
  }

  /**
   * Unsubscribe from asset updates
   */
  unsubscribe(assetIds: string[]): void {
    for (const assetId of assetIds) {
      this.orderBookCallbacks.delete(assetId);
      this.priceCallbacks.delete(assetId);
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "unsubscribe",
          assets_ids: assetIds,
        })
      );
    }
  }

  /**
   * Set error callback
   */
  setErrorHandler(callback: ErrorCallback): void {
    this.onError = callback;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private sendSubscription(
    assetIds: string[],
    type: "book" | "price" | "user"
  ): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(
      JSON.stringify({
        type: "subscribe",
        channel: type,
        assets_ids: assetIds,
      })
    );
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      if (message.type === "book" && message.data) {
        const orderBook = this.parseOrderBook(message);
        const callbacks = this.orderBookCallbacks.get(message.asset_id) || [];
        for (const callback of callbacks) {
          callback(orderBook);
        }
      }

      if (message.type === "price_change" && message.data) {
        const callbacks = this.priceCallbacks.get(message.asset_id) || [];
        for (const callback of callbacks) {
          callback(message.asset_id, message.data.price);
        }
      }
    } catch (error) {
      console.error("[WS] Failed to parse message:", error);
    }
  }

  private parseOrderBook(message: Record<string, unknown>): OrderBook {
    const data = message.data as Record<string, unknown>;
    return {
      market: (message.market as string) || "",
      asset_id: message.asset_id as string,
      bids: (data.bids as OrderBookEntry[]) || [],
      asks: (data.asks as OrderBookEntry[]) || [],
      timestamp: (data.timestamp as string) || new Date().toISOString(),
    };
  }

  private resubscribeAll(): void {
    const bookAssets = Array.from(this.orderBookCallbacks.keys());
    const priceAssets = Array.from(this.priceCallbacks.keys());

    if (bookAssets.length > 0) {
      this.sendSubscription(bookAssets, "book");
    }

    if (priceAssets.length > 0) {
      this.sendSubscription(priceAssets, "price");
    }
  }

  private attemptReconnect(): void {
    if (!this.shouldReconnect) {
      return;
    }

    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error("[WS] Max reconnection attempts reached");
      if (this.onError) {
        this.onError(new Error("Max reconnection attempts reached"));
      }
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `[WS] Reconnecting in ${this.config.reconnectInterval}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`
    );

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error("[WS] Reconnection failed:", error);
      });
    }, this.config.reconnectInterval);
  }
}

// Singleton instance for shared use
let wsInstance: PolymarketWebSocket | null = null;

export function getWebSocket(): PolymarketWebSocket {
  if (!wsInstance) {
    wsInstance = new PolymarketWebSocket();
  }
  return wsInstance;
}
