# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server at http://localhost:3000
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Architecture

Next.js 16 App Router application with React 19, TypeScript, Tailwind CSS v4, and shadcn/ui. This is a Polymarket trading bot with a dashboard UI.

### Core Modules

**`src/lib/polymarket/`** - Polymarket SDK integration:
- `client.ts` - SDK initialization with GammaSDK (market data, no auth) and ClobClient (trading, requires auth)
- `websocket.ts` - `PolymarketWebSocket` class for real-time order book and price streaming with auto-reconnect
- `types.ts` - Type definitions for markets, orders, positions, and strategy configs

**`src/lib/strategies/`** - Trading strategies:
- `market-maker.ts` - `MarketMaker` class providing bid/ask liquidity around mid-price with configurable spread
- `arbitrage.ts` - `ArbitrageDetector` class finding YES/NO mispricing opportunities (when YES + NO < 1.0)

Both strategies use singleton pattern via `getMarketMaker()` and `getArbitrageDetector()`.

**`src/app/api/`** - REST API routes:
- `GET /api/markets` - Fetch active markets (params: `limit`, `active`)
- `GET /api/bot/status` - Bot status including portfolio balance, active strategies, and arbitrage opportunities

**`src/app/dashboard/`** - React dashboard showing portfolio, market data, and arbitrage alerts.

### Environment Variables

Required for trading operations (not needed for market data):
```
POLYMARKET_PRIVATE_KEY      # Wallet private key
POLYMARKET_FUNDER_ADDRESS   # Wallet address for trades
POLYMARKET_CHAIN_ID         # Default: 137 (Polygon)
POLYMARKET_CLOB_HOST        # Default: https://clob.polymarket.com
POLYMARKET_GAMMA_HOST       # Default: https://gamma-api.polymarket.com
```

### Key Dependencies

- `@hk/polymarket` (GammaSDK) - Market data fetching
- `@polymarket/clob-client` - Order execution and account management
- shadcn/ui with Lucide icons

**Import alias:** `@/*` maps to `./src/*`
