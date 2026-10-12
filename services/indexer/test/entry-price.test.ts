import assert from "node:assert/strict";
import test from "node:test";
import { entryPriceE6 } from "../src/entry-price.ts";
import type { EventProjection, PositionProjection } from "../src/store.ts";

let n = 0;
const fill = (portfolio: string, sizeQ: number, priceE6: number, lpPortfolio = "LP"): EventProjection => ({
  signature: `sig${++n}`,
  instructionIndex: 0,
  slot: n,
  kind: "trade",
  marketId: "3",
  portfolio,
  data: { tag: "10", assetIndex: "2", sizeQ: String(sizeQ), executedSizeQ: String(Math.abs(sizeQ)), executionPriceE6: String(priceE6), lpPortfolio },
});
const position = (sizeQ: number): PositionProjection => ({ slot: 0, assetIndex: 2, marketId: "3", side: sizeQ > 0 ? "long" : "short", sizeQ: String(sizeQ), aBasis: "1000000000000000", stale: false });

test("averages entries and keeps the average when reducing", () => {
  const events = [fill("A", 2_000_000, 500_000), fill("A", 2_000_000, 600_000), fill("A", -1_000_000, 700_000)];
  assert.equal(entryPriceE6(position(3_000_000), "A", events), "550000");
});

test("short positions and flips use the new side's price", () => {
  const events = [fill("A", 1_000_000, 400_000), fill("A", -3_000_000, 450_000)];
  assert.equal(entryPriceE6(position(-2_000_000), "A", events), "450000");
});

test("the liquidity provider takes the opposite side of each fill", () => {
  const events = [fill("A", 2_000_000, 520_000, "LP")];
  assert.equal(entryPriceE6(position(-2_000_000), "LP", events), "520000");
});

test("returns null when indexed fills don't match the on-chain size", () => {
  const events = [fill("A", 2_000_000, 500_000)];
  assert.equal(entryPriceE6(position(1_000_000), "A", events), null);
  assert.equal(entryPriceE6(position(1_000_000), "B", events), null);
});
