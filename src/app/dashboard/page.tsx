"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, Activity, AlertCircle, Wallet, DollarSign } from "lucide-react";

interface BotStatus {
  configured: boolean;
  config: {
    funderAddress: string;
    chainId: number;
    clobHost: string;
    gammaHost: string;
  };
  marketMaker: {
    activeMarkets: number;
  };
  arbitrage: {
    monitoredMarkets: number;
    opportunities: Array<{
      markets: string[];
      spread: number;
      expectedProfit: number;
    }>;
  };
  portfolio?: {
    totalValue: number;
    cashBalance: number;
    positionsValue: number;
  };
}

interface Market {
  id: string;
  question: string;
  outcomePrices?: string[];
  volume?: string;
  active: boolean;
}

export default function DashboardPage() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [statusRes, marketsRes] = await Promise.all([
        fetch("/api/bot/status"),
        fetch("/api/markets?limit=10"),
      ]);

      const statusData = await statusRes.json();
      const marketsData = await marketsRes.json();

      if (statusData.success) {
        setStatus(statusData.data);
      } else {
        setError(statusData.error || "Failed to fetch status");
      }

      if (marketsData.success) {
        setMarkets(marketsData.data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const portfolioValue = status?.portfolio?.totalValue ?? 0;
  const cashBalance = status?.portfolio?.cashBalance ?? 0;
  const positionsValue = status?.portfolio?.positionsValue ?? 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Top Status Bar */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              {/* Portfolio Value */}
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Portfolio</p>
                  <p className="text-xl font-bold">${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>

              {/* Cash Balance */}
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Cash</p>
                  <p className="text-xl font-bold">${cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>

              {/* Positions Value */}
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Positions</p>
                  <p className="text-xl font-bold">${positionsValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Connection Status */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${status?.configured ? "bg-green-500" : "bg-yellow-500"}`} />
                <span className="text-sm text-muted-foreground">
                  {status?.configured ? "Connected" : "Not configured"}
                </span>
              </div>

              <Button onClick={fetchData} disabled={loading} variant="outline" size="sm">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-8">

        {/* Error Banner */}
        {error && (
          <div className="bg-destructive/10 border border-destructive rounded-lg p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <span className="text-destructive">{error}</span>
          </div>
        )}

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Configuration Status */}
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-3 h-3 rounded-full ${
                  status?.configured ? "bg-green-500" : "bg-yellow-500"
                }`}
              />
              <h2 className="font-semibold">Configuration</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {status?.configured
                ? "API credentials configured"
                : "Missing API credentials - set .env variables"}
            </p>
            {status?.config && (
              <div className="mt-3 text-xs text-muted-foreground">
                <p>Chain ID: {status.config.chainId}</p>
                <p className="truncate">
                  Funder: {status.config.funderAddress || "Not set"}
                </p>
              </div>
            )}
          </div>

          {/* Market Making Status */}
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              <h2 className="font-semibold">Market Making</h2>
            </div>
            <p className="text-2xl font-bold">
              {status?.marketMaker.activeMarkets || 0}
            </p>
            <p className="text-sm text-muted-foreground">Active markets</p>
          </div>

          {/* Arbitrage Status */}
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="w-5 h-5 text-purple-500" />
              <h2 className="font-semibold">Arbitrage</h2>
            </div>
            <p className="text-2xl font-bold">
              {status?.arbitrage.opportunities.length || 0}
            </p>
            <p className="text-sm text-muted-foreground">
              Opportunities detected
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Monitoring {status?.arbitrage.monitoredMarkets || 0} markets
            </p>
          </div>
        </div>

        {/* Markets List */}
        <div className="bg-card border rounded-lg">
          <div className="p-6 border-b">
            <h2 className="font-semibold">Active Markets</h2>
            <p className="text-sm text-muted-foreground">
              Top markets by activity
            </p>
          </div>
          <div className="divide-y">
            {markets.length === 0 && !loading && (
              <div className="p-6 text-center text-muted-foreground">
                No markets loaded
              </div>
            )}
            {markets.map((market) => (
              <div
                key={market.id}
                className="p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 mr-4">
                    <p className="font-medium line-clamp-2">
                      {market.question}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      ID: {market.id.slice(0, 16)}...
                    </p>
                  </div>
                  <div className="text-right">
                    {market.outcomePrices && market.outcomePrices.length >= 2 && (
                      <div className="flex gap-4 text-sm">
                        <span className="text-green-600">
                          YES: {(parseFloat(market.outcomePrices[0]) * 100).toFixed(1)}%
                        </span>
                        <span className="text-red-600">
                          NO: {(parseFloat(market.outcomePrices[1]) * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                    {market.volume && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Vol: ${parseFloat(market.volume).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Arbitrage Opportunities */}
        {status?.arbitrage.opportunities &&
          status.arbitrage.opportunities.length > 0 && (
            <div className="bg-card border rounded-lg mt-6">
              <div className="p-6 border-b">
                <h2 className="font-semibold text-purple-600">
                  Arbitrage Opportunities
                </h2>
              </div>
              <div className="divide-y">
                {status.arbitrage.opportunities.map((opp, idx) => (
                  <div key={idx} className="p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">
                        Markets: {opp.markets.join(", ")}
                      </span>
                      <div className="text-right">
                        <p className="font-medium text-green-600">
                          +${opp.expectedProfit.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Spread: {(opp.spread * 100).toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            Built with{" "}
            <a
              href="https://github.com/HuakunShen/polymarket-kit"
              className="underline hover:text-foreground"
              target="_blank"
              rel="noopener noreferrer"
            >
              polymarket-kit
            </a>{" "}
            &{" "}
            <a
              href="https://github.com/Polymarket/clob-client"
              className="underline hover:text-foreground"
              target="_blank"
              rel="noopener noreferrer"
            >
              @polymarket/clob-client
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
