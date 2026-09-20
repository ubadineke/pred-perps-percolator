import assert from "node:assert/strict";
import test from "node:test";
import { calculateReference, UnsafeReferenceError, type ProbabilityBook, type ReferencePolicy } from "../src/reference.ts";

const policy: ReferencePolicy = {
  maxAgeMs: 5_000, degradedAgeMs: 2_000, maxSpreadE6: 80_000, degradedSpreadE6: 30_000,
  minDepthE6: 10_000_000n, impactSizeE6: 10_000_000n, twapWindowMs: 60_000,
  medianWindowSize: 3, epsilonE6: 1_000,
};
const book: ProbabilityBook = {
  yesBids: [{ priceE6: 550_000, sizeE6: 4_000_000n }, { priceE6: 540_000, sizeE6: 8_000_000n }],
  yesAsks: [{ priceE6: 570_000, sizeE6: 5_000_000n }, { priceE6: 580_000, sizeE6: 7_000_000n }],
  observedAtMs: 100_000,
};

test("uses meaningful book depth instead of top-of-book dust", () => {
  const result = calculateReference(book, [], policy, 101_000);
  assert.equal(result.impactBidE6, 544_000);
  assert.equal(result.impactAskE6, 575_000);
  assert.equal(result.rawImpactMidpointE6, 559_500);
  assert.equal(result.probabilityE6, 559_500);
  assert.equal(result.health, "degraded");
});

test("median filter and time weighting damp one isolated external tick", () => {
  const result = calculateReference(book, [
    { probabilityE6: 520_000, observedAtMs: 50_000 },
    { probabilityE6: 540_000, observedAtMs: 80_000 },
    { probabilityE6: 900_000, observedAtMs: 90_000 },
  ], policy, 101_000);
  assert(result.probabilityE6 < 650_000);
  assert(result.probabilityE6 > 500_000);
});

test("stale, crossed, thin, wide, and incomplete books fail closed", () => {
  assert.throws(() => calculateReference(book, [], policy, 106_000), UnsafeReferenceError);
  assert.throws(() => calculateReference({ ...book, yesBids: [{ priceE6: 590_000, sizeE6: 20_000_000n }] }, [], policy, 101_000), /crossed-book/);
  assert.throws(() => calculateReference({ ...book, yesBids: [{ priceE6: 550_000, sizeE6: 9_999_999n }] }, [], policy, 101_000), /depth-too-low/);
  assert.throws(() => calculateReference({ ...book, yesAsks: [{ priceE6: 700_000, sizeE6: 20_000_000n }] }, [], policy, 101_000), /spread-too-wide/);
  assert.throws(() => calculateReference({ ...book, yesBids: [] }, [], policy, 101_000), /empty-book/);
});

test("live probability endpoints are reserved for settlement", () => {
  assert.throws(() => calculateReference({ ...book, yesBids: [{ priceE6: 0, sizeE6: 20_000_000n }] }, [], policy, 101_000), /invalid-price/);
});
