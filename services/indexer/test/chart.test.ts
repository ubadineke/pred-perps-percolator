import assert from "node:assert/strict";
import test from "node:test";
import { buildMarketChart, parseChartRange } from "../src/chart.ts";
import type { EventProjection, PricePoint } from "../src/store.ts";

const price = (slot: number, observedAt: number, markE6: string, indexE6 = markE6): PricePoint => ({
  slot, observedAt: String(observedAt), markE6, indexE6, localMidE6: markE6, basisTwapE6: "0",
});
const fill = (slot: number, sizeQ: string, executionPriceE6: string, blockTime?: number): EventProjection => ({
  signature: `sig-${slot}`, instructionIndex: 0, slot, kind: "trade", marketId: "2", portfolio: "p", blockTime,
  data: { sizeQ, executedSizeQ: sizeQ, executionPriceE6 },
});

test("defaults unknown ranges to one day", () => {
  assert.equal(parseChartRange(null), "1d");
  assert.equal(parseChartRange("bogus"), "1d");
  assert.equal(parseChartRange("1w"), "1w");
});

test("builds mark/index lines in cents and keeps the last value per bucket", () => {
  const now = 10_000;
  const chart = buildMarketChart(
    [price(1, now - 150, "500000", "490000"), price(2, now - 130, "510000", "495000"), price(3, now - 30, "520000", "500000")],
    [],
    "1h",
    now,
  );
  assert.equal(chart.bucketSeconds, 60);
  // now-150 and now-130 share a 60s bucket: the later observation wins.
  assert.deepEqual(chart.mark.map((p) => p.value), [51, 52]);
  assert.deepEqual(chart.index.map((p) => p.value), [49.5, 50]);
});

test("carries the last observation into a quiet window", () => {
  const now = 100_000;
  const chart = buildMarketChart([price(1, now - 50_000, "530000")], [], "1h", now);
  assert.equal(chart.mark.length, 1);
  assert.equal(chart.mark[0].value, 53);
});

test("dates fills from blockTime, else estimates from the nearest observation's slot", () => {
  const now = 10_000;
  const chart = buildMarketChart(
    [price(1_000, now - 600, "500000")],
    [fill(1_050, "2000000", "507800", now - 300), fill(1_100, "-1000000", "493000")],
    "1h",
    now,
  );
  assert.equal(chart.fills.length, 2);
  const dated = chart.fills.find((f) => f.signature === "sig-1050");
  const estimated = chart.fills.find((f) => f.signature === "sig-1100");
  assert.deepEqual(dated, { time: now - 300, price: 50.78, size: 2, side: "long", portfolio: "p", signature: "sig-1050" });
  // 100 slots after the anchor at 0.4s per slot.
  assert.equal(estimated?.time, now - 600 + 40);
  assert.equal(estimated?.side, "short");
});

test("aggregates fills into OHLC candles", () => {
  const now = 10_000;
  const base = Math.floor((now - 50) / 60) * 60;
  const chart = buildMarketChart(
    [],
    [fill(1, "1000000", "500000", base + 1), fill(2, "1000000", "540000", base + 20), fill(3, "-2000000", "480000", base + 40), fill(4, "1000000", "510000", base + 59)],
    "1h",
    now,
  );
  assert.deepEqual(chart.candles, [{ time: base, open: 50, high: 54, low: 48, close: 51, volume: 5 }]);
});
