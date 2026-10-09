import type { EventProjection, PricePoint } from "./store.ts";

// Chart data for one market, built only from Moxie's own on-chain records:
// the protected mark and source index from oracle observations, and executed
// fills. Prices are returned in cents (0–100) so the client can plot them directly.

export type ChartRange = "1h" | "1d" | "1w" | "all";
export type ChartPoint = { time: number; value: number };
export type ChartFill = { time: number; price: number; size: number; side: "long" | "short"; portfolio?: string; signature: string };
export type ChartCandle = { time: number; open: number; high: number; low: number; close: number; volume: number };
export type MarketChart = { range: ChartRange; bucketSeconds: number; mark: ChartPoint[]; index: ChartPoint[]; fills: ChartFill[]; candles: ChartCandle[] };

const RANGE_SECONDS: Record<Exclude<ChartRange, "all">, number> = { "1h": 3_600, "1d": 86_400, "1w": 604_800 };
const BUCKET_SECONDS: Record<Exclude<ChartRange, "all">, number> = { "1h": 60, "1d": 900, "1w": 3_600 };
const SLOT_SECONDS = 0.4;
const cents = (e6: string | undefined) => Number(e6 ?? 0) / 10_000;

export function parseChartRange(value: string | null): ChartRange {
  return value === "1h" || value === "1d" || value === "1w" || value === "all" ? value : "1d";
}

/** Estimates a fill's wall-clock time from its slot when the RPC did not report blockTime. */
function slotClock(prices: readonly PricePoint[]) {
  const anchors = prices
    .map((p) => ({ slot: p.slot, time: Number(p.observedAt) }))
    .filter((a) => a.slot > 0 && a.time > 0)
    .sort((a, b) => a.slot - b.slot);
  return (slot: number): number | undefined => {
    if (!anchors.length) return undefined;
    let nearest = anchors[0];
    for (const anchor of anchors) if (Math.abs(anchor.slot - slot) < Math.abs(nearest.slot - slot)) nearest = anchor;
    return Math.round(nearest.time + (slot - nearest.slot) * SLOT_SECONDS);
  };
}

/** Keeps the last value in each time bucket, so long ranges stay small. */
function bucketLast(points: ChartPoint[], bucket: number): ChartPoint[] {
  const out = new Map<number, ChartPoint>();
  for (const point of points) {
    const time = Math.floor(point.time / bucket) * bucket;
    out.set(time, { time, value: point.value });
  }
  return [...out.values()].sort((a, b) => a.time - b.time);
}

export function buildMarketChart(
  prices: readonly PricePoint[],
  trades: readonly EventProjection[],
  range: ChartRange,
  now = Math.floor(Date.now() / 1000),
): MarketChart {
  const clock = slotClock(prices);
  const allPrices = prices
    .map((p) => ({ time: Number(p.observedAt), mark: cents(p.markE6), index: cents(p.indexE6) }))
    .filter((p) => p.time > 0)
    .sort((a, b) => a.time - b.time);
  const allFills: ChartFill[] = trades
    .map((trade) => {
      const time = trade.blockTime ?? clock(trade.slot);
      const sizeQ = Number(trade.data.executedSizeQ ?? trade.data.sizeQ ?? 0);
      const price = cents(trade.data.executionPriceE6 ?? trade.data.limitPriceE6);
      if (time === undefined || !sizeQ || !price) return undefined;
      return { time, price, size: Math.abs(sizeQ) / 1_000_000, side: sizeQ > 0 ? "long" : "short", portfolio: trade.portfolio, signature: trade.signature } as ChartFill;
    })
    .filter((fill): fill is ChartFill => fill !== undefined)
    .sort((a, b) => a.time - b.time);

  const earliest = Math.min(allPrices[0]?.time ?? now, allFills[0]?.time ?? now);
  const span = range === "all" ? Math.max(now - earliest, 60) : RANGE_SECONDS[range];
  const bucket = range === "all" ? Math.max(60, Math.ceil(span / 300 / 60) * 60) : BUCKET_SECONDS[range];
  const from = now - span;

  const inRange = allPrices.filter((p) => p.time >= from);
  // Carry the last value from before the window so a quiet market still draws a line.
  const before = allPrices.filter((p) => p.time < from).at(-1);
  const seeded = before ? [{ ...before, time: from }, ...inRange] : inRange;
  const fills = allFills.filter((f) => f.time >= from);

  const candles = new Map<number, ChartCandle>();
  for (const fill of fills) {
    const time = Math.floor(fill.time / bucket) * bucket;
    const candle = candles.get(time);
    if (!candle) candles.set(time, { time, open: fill.price, high: fill.price, low: fill.price, close: fill.price, volume: fill.size });
    else {
      candle.high = Math.max(candle.high, fill.price);
      candle.low = Math.min(candle.low, fill.price);
      candle.close = fill.price;
      candle.volume += fill.size;
    }
  }

  return {
    range,
    bucketSeconds: bucket,
    mark: bucketLast(seeded.map((p) => ({ time: p.time, value: p.mark })), bucket),
    index: bucketLast(seeded.filter((p) => p.index > 0).map((p) => ({ time: p.time, value: p.index })), bucket),
    fills,
    candles: [...candles.values()].sort((a, b) => a.time - b.time),
  };
}
