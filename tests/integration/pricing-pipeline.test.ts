import assert from "node:assert/strict";
import test from "node:test";
import { encodePricingObservation } from "../../packages/sdk/src/imported-market.ts";
import { calculateReference } from "../../services/oracle-reporter/src/reference.ts";

test("depth-aware reference becomes a bound pricing observation", () => {
  const reference = calculateReference({
    yesBids: [{ priceE6: 590_000, sizeE6: 20_000_000n }],
    yesAsks: [{ priceE6: 610_000, sizeE6: 20_000_000n }],
    observedAtMs: 1_000_000,
  }, [], {
    maxAgeMs: 10_000, degradedAgeMs: 5_000,
    maxSpreadE6: 50_000, degradedSpreadE6: 30_000,
    minDepthE6: 10_000_000n, impactSizeE6: 10_000_000n,
    twapWindowMs: 60_000, medianWindowSize: 3, epsilonE6: 1_000,
  }, 1_001_000);
  const encoded = encodePricingObservation({
    externalMarketId: "provider-market-1", rules: "provider final result",
    assetIndex: 0, marketId: 1n,
  }, {
    indexE6: BigInt(reference.probabilityE6),
    externalImpactBidE6: BigInt(reference.impactBidE6),
    externalImpactAskE6: BigInt(reference.impactAskE6),
    localImpactBidE6: 592_000n, localImpactAskE6: 612_000n,
    sourceTimestamp: 1_000n, sequence: 2n,
    oracleHealth: reference.health === "healthy" ? 1 : 2,
  });
  const view = new DataView(encoded.buffer);
  assert.equal(encoded[0], 4);
  assert.equal(view.getBigUint64(75, true), 600_000n);
  assert.equal(view.getBigUint64(83, true), 590_000n);
  assert.equal(view.getBigUint64(91, true), 610_000n);
  assert.equal(encoded[131], 1);
});
