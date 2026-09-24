import assert from "node:assert/strict";
import test from "node:test";
import { encodeActivateImportedPerp, encodePricingObservation, encodeResolutionObservation, hashIdentity } from "../src/imported-market.ts";

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

test("activation v2 binds an ordered lock-clock", () => {
  const encoded = encodeActivateImportedPerp(identity, 550_000n, 99n, {
    restrictedAt: 1_999_990_000n,
    reduceOnlyAt: 1_999_995_000n,
    hardFlatAt: 1_999_999_000n,
  });
  const view = new DataView(encoded.buffer);
  assert.equal(encoded.length, 219);
  assert.equal(encoded[0], 5);
  assert.equal(view.getBigInt64(195, true), 1_999_990_000n);
  assert.equal(view.getBigInt64(203, true), 1_999_995_000n);
  assert.equal(view.getBigInt64(211, true), 1_999_999_000n);
  assert.throws(() => encodeActivateImportedPerp(identity, 550_000n, 99n, {
    restrictedAt: 20n, reduceOnlyAt: 10n, hardFlatAt: 30n,
  }), /lock-clock/);
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

test("resolution observations bind identity, terminal outcome, timestamp, and sequence", () => {
  const encoded = encodeResolutionObservation(identity, {
    outcome: 1,
    sourceTimestamp: 2_000_000_001n,
    sequence: 3n,
  });
  const view = new DataView(encoded.buffer);
  assert.equal(encoded.length, 92);
  assert.equal(encoded[0], 8);
  assert.equal(view.getUint16(65, true), 1);
  assert.equal(view.getBigUint64(67, true), 7n);
  assert.equal(encoded[75], 1);
  assert.equal(view.getBigInt64(76, true), 2_000_000_001n);
  assert.equal(view.getBigUint64(84, true), 3n);
});
