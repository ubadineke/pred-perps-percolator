import { buildMarketChart } from "./chart.ts";
import type { EventProjection, PortfolioProjection, PricePoint } from "./store.ts";

// Per-market summary numbers for listings, derived from the same on-chain data as the chart.
export type MarketStats = {
  /** Mark change over the last 24h, in cents (probability points). Null without history. */
  change24hCents: number | null;
  /** Executed notional over the last 24h, in USD. */
  volume24hUsd: number;
  /** Open long contracts (equal to open short contracts on a matched market). */
  openInterestContracts: number;
  /** Open interest valued at the current mark, in USD. */
  openInterestUsd: number;
};

export function buildMarketStats(
  market: { assetIndex: number; marketId: string; markE6: string },
  prices: readonly PricePoint[],
  trades: readonly EventProjection[],
  portfolios: Iterable<PortfolioProjection>,
  now = Math.floor(Date.now() / 1000),
): MarketStats {
  const day = buildMarketChart(prices, trades, "1d", now);
  const first = day.mark[0]?.value;
  const last = day.mark.at(-1)?.value;
  const change24hCents = first !== undefined && last !== undefined && day.mark.length > 1 ? Math.round((last - first) * 100) / 100 : null;
  const volume24hUsd = day.fills.reduce((sum, fill) => sum + (fill.size * fill.price) / 100, 0);

  let openInterestContracts = 0;
  for (const portfolio of portfolios) {
    for (const position of portfolio.positions) {
      if (position.assetIndex === market.assetIndex && position.marketId === market.marketId && position.side === "long") {
        openInterestContracts += Math.abs(Number(position.sizeQ)) / 1_000_000;
      }
    }
  }
  const markUsd = Number(market.markE6) / 1_000_000;
  return { change24hCents, volume24hUsd, openInterestContracts, openInterestUsd: openInterestContracts * markUsd };
}
