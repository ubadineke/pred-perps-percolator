import type { EventProjection, PortfolioProjection, PositionProjection } from "./store.ts";

// Percolator v16 does not store an entry price per position, so the indexer derives one by
// replaying the portfolio's indexed fills with average-cost accounting.

export type PositionWithEntry = PositionProjection & {
  /** Average entry price in E6, or null when the indexed fills don't reproduce the on-chain size. */
  entryPriceE6: string | null;
};

const abs = (x: bigint) => (x < 0n ? -x : x);

/** Signed fill size for `portfolio` (positive = bought), or undefined if it wasn't a party. */
function fillFor(event: EventProjection, portfolio: string): { sizeQ: bigint; priceE6: bigint } | undefined {
  const { sizeQ, executedSizeQ, executionPriceE6, lpPortfolio } = event.data;
  if (event.kind !== "trade" || !sizeQ || !executionPriceE6) return undefined;
  const requested = BigInt(sizeQ);
  const magnitude = executedSizeQ ? abs(BigInt(executedSizeQ)) : abs(requested);
  const traderSize = requested < 0n ? -magnitude : magnitude;
  if (event.portfolio === portfolio) return { sizeQ: traderSize, priceE6: BigInt(executionPriceE6) };
  if (lpPortfolio === portfolio) return { sizeQ: -traderSize, priceE6: BigInt(executionPriceE6) };
  return undefined;
}

export function entryPriceE6(position: PositionProjection, portfolio: string, events: Iterable<EventProjection>): string | null {
  const fills = [...events]
    .filter((e) => e.marketId === position.marketId && e.data.assetIndex === String(position.assetIndex))
    .sort((a, b) => a.slot - b.slot || a.instructionIndex - b.instructionIndex)
    .map((e) => fillFor(e, portfolio))
    .filter((f): f is NonNullable<typeof f> => f !== undefined);

  let size = 0n;
  let cost = 0n; // sum of |q| * price over the open position, in q·E6
  for (const fill of fills) {
    if (size === 0n || (size > 0n) === (fill.sizeQ > 0n)) {
      size += fill.sizeQ;
      cost += abs(fill.sizeQ) * fill.priceE6;
    } else if (abs(fill.sizeQ) <= abs(size)) {
      cost = (cost * (abs(size) - abs(fill.sizeQ))) / abs(size);
      size += fill.sizeQ;
    } else {
      size += fill.sizeQ;
      cost = abs(size) * fill.priceE6;
    }
  }
  // Missed history, liquidations or hard-flat closes leave the replay out of step; don't guess.
  if (size === 0n || size !== BigInt(position.sizeQ)) return null;
  return (cost / abs(size)).toString();
}

export function withEntryPrices(portfolio: PortfolioProjection, events: Iterable<EventProjection>): PortfolioProjection & { positions: PositionWithEntry[] } {
  const list = [...events];
  return { ...portfolio, positions: portfolio.positions.map((p) => ({ ...p, entryPriceE6: entryPriceE6(p, portfolio.address, list) })) };
}
