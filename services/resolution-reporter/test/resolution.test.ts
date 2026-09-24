import assert from "node:assert/strict";
import test from "node:test";
import { UnsafeResolutionError, validateFinalResolution } from "../src/resolution.ts";

const now = 2_000_000;
const policy = { expectedMarketId: "event-1", closeTimeMs: 1_900_000, maxAgeMs: 300_000 };

test("accepts only a final identity-bound post-close result", () => {
  assert.deepEqual(validateFinalResolution({
    marketId: "event-1", outcome: "YES", finalized: true, disputed: false, observedAtMs: 1_950_000,
  }, policy, now), { outcome: 1, sourceTimestamp: 1950n });
});

for (const [name, mutation] of [
  ["wrong identity", { marketId: "event-2" }],
  ["provisional", { finalized: false }],
  ["disputed", { disputed: true }],
  ["early", { observedAtMs: 1_800_000 }],
] as const) {
  test(`rejects ${name} results`, () => {
    const base = { marketId: "event-1", outcome: "NO" as const, finalized: true, disputed: false, observedAtMs: 1_950_000 };
    assert.throws(() => validateFinalResolution({ ...base, ...mutation }, policy, now), UnsafeResolutionError);
  });
}
