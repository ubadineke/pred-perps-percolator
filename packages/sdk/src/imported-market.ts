import { createHash } from "node:crypto";

export type ImportedMarketIdentity = {
  externalMarketId: string;
  externalYesId: string;
  externalNoId: string;
  title: string;
  rules: string;
  externalCloseTime: bigint;
  assetIndex: number;
  marketId: bigint;
};

export type PricingObservation = {
  indexE6: bigint;
  externalImpactBidE6: bigint;
  externalImpactAskE6: bigint;
  localImpactBidE6: bigint;
  localImpactAskE6: bigint;
  sourceTimestamp: bigint;
  sequence: bigint;
  oracleHealth: 1 | 2;
};

export function hashIdentity(value: string): Uint8Array {
  if (!value.trim()) throw new Error("identity fields cannot be empty");
  return createHash("sha256").update(value, "utf8").digest();
}

export function encodeActivateImportedPerp(
  identity: ImportedMarketIdentity,
  mark: bigint,
  slot: bigint,
): Uint8Array {
  probability(mark);
  if (identity.assetIndex < 0 || identity.assetIndex > 0xffff) throw new Error("invalid asset index");
  const output = new Uint8Array(195);
  const view = new DataView(output.buffer);
  output[0] = 1;
  let offset = 1;
  for (const value of [identity.externalMarketId, identity.externalYesId, identity.externalNoId, identity.title, identity.rules]) {
    output.set(hashIdentity(value), offset);
    offset += 32;
  }
  view.setBigInt64(offset, identity.externalCloseTime, true); offset += 8;
  view.setUint16(offset, identity.assetIndex, true); offset += 2;
  view.setBigUint64(offset, identity.marketId, true); offset += 8;
  view.setBigUint64(offset, mark, true); offset += 8;
  view.setBigUint64(offset, slot, true);
  return output;
}

export function encodePricingObservation(
  identity: Pick<ImportedMarketIdentity, "externalMarketId" | "rules" | "assetIndex" | "marketId">,
  observation: PricingObservation,
): Uint8Array {
  for (const price of [
    observation.indexE6,
    observation.externalImpactBidE6,
    observation.externalImpactAskE6,
    observation.localImpactBidE6,
    observation.localImpactAskE6,
  ]) probability(price);
  if (observation.externalImpactBidE6 > observation.externalImpactAskE6) throw new Error("crossed external impact prices");
  if (observation.localImpactBidE6 > observation.localImpactAskE6) throw new Error("crossed local impact prices");
  const output = new Uint8Array(132);
  const view = new DataView(output.buffer);
  output[0] = 4;
  output.set(hashIdentity(identity.externalMarketId), 1);
  output.set(hashIdentity(identity.rules), 33);
  view.setUint16(65, identity.assetIndex, true);
  view.setBigUint64(67, identity.marketId, true);
  view.setBigUint64(75, observation.indexE6, true);
  view.setBigUint64(83, observation.externalImpactBidE6, true);
  view.setBigUint64(91, observation.externalImpactAskE6, true);
  view.setBigUint64(99, observation.localImpactBidE6, true);
  view.setBigUint64(107, observation.localImpactAskE6, true);
  view.setBigInt64(115, observation.sourceTimestamp, true);
  view.setBigUint64(123, observation.sequence, true);
  output[131] = observation.oracleHealth;
  return output;
}

function probability(value: bigint): void {
  if (value < 1n || value > 999_999n) throw new Error("probability must be inside the open 0..1 interval");
}
