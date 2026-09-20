import assert from "node:assert/strict";
import test from "node:test";
import { encodeActivateImportedPerp, encodePricingObservation, hashIdentity } from "../src/imported-market.ts";

const identity = {
  externalMarketId: "market-42", externalYesId: "yes", externalNoId: "no",
  title: "Will it ship?", rules: "Official result only", externalCloseTime: 2_000_000_000n,
  assetIndex: 1, marketId: 7n,
};

test("activation freezes the full source identity", () => {
  const encoded = encodeActivateImportedPerp(identity, 550_000n, 99n);
  assert.equal(encoded.length, 195);
  assert.equal(Buffer.from(encoded.slice(1, 33)).toString("hex"), Buffer.from(hashIdentity("market-42")).toString("hex"));
  assert.equal(new DataView(encoded.buffer).getBigUint64(171, true), 7n);
});

test("pricing observations bind auditable index, impact, health, and sequence inputs", () => {
  const encoded = encodePricingObservation(identity, {
    indexE6: 560_000n,
    externalImpactBidE6: 550_000n,
    externalImpactAskE6: 570_000n,
    localImpactBidE6: 545_000n,
    localImpactAskE6: 575_000n,
    sourceTimestamp: 1_800_000_000n,
    sequence: 2n,
    oracleHealth: 1,
  });
  const view = new DataView(encoded.buffer);
  assert.equal(encoded.length, 132);
  assert.equal(encoded[0], 4);
  assert.equal(view.getBigUint64(67, true), 7n);
  assert.equal(view.getBigUint64(75, true), 560_000n);
  assert.equal(view.getBigUint64(123, true), 2n);
  assert.equal(encoded[131], 1);
});

test("pricing observation encoding rejects terminal and crossed live prices", () => {
  const base = {
    indexE6: 560_000n, externalImpactBidE6: 550_000n, externalImpactAskE6: 570_000n,
    localImpactBidE6: 545_000n, localImpactAskE6: 575_000n,
    sourceTimestamp: 1n, sequence: 2n, oracleHealth: 1 as const,
  };
  assert.throws(() => encodePricingObservation(identity, { ...base, indexE6: 1_000_000n }), /probability/);
  assert.throws(() => encodePricingObservation(identity, { ...base, externalImpactBidE6: 580_000n }), /crossed/);
});
