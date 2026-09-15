import type { ExternalMarket } from "./types.ts";

export type EligibilityPolicy = {
  minTimeToCloseMs: number;
  maxObservationAgeMs: number;
  maxYesSpreadE6: number;
  minVolumeUsdE6: bigint;
  requireRules: boolean;
};

export type EligibilityReason =
  | "not-open"
  | "closes-too-soon"
  | "stale-observation"
  | "missing-rules"
  | "missing-two-sided-price"
  | "invalid-price"
  | "spread-too-wide"
  | "volume-too-low";

export type Eligibility = { eligible: boolean; reasons: EligibilityReason[] };

export const DEFAULT_ELIGIBILITY_POLICY: EligibilityPolicy = {
  minTimeToCloseMs: 24 * 60 * 60 * 1_000,
  maxObservationAgeMs: 60 * 1_000,
  maxYesSpreadE6: 100_000,
  minVolumeUsdE6: 1_000_000_000n,
  requireRules: true,
};

export function assessEligibility(
  market: ExternalMarket,
  now: number,
  policy: EligibilityPolicy = DEFAULT_ELIGIBILITY_POLICY,
): Eligibility {
  const reasons: EligibilityReason[] = [];
  if (market.status !== "open") reasons.push("not-open");
  if (market.closeTime - now < policy.minTimeToCloseMs) reasons.push("closes-too-soon");
  if (now - market.observedAt > policy.maxObservationAgeMs) reasons.push("stale-observation");
  if (policy.requireRules && !market.rules.trim()) reasons.push("missing-rules");
  if (market.yesBidE6 === undefined || market.yesAskE6 === undefined) {
    reasons.push("missing-two-sided-price");
  } else if (
    market.yesBidE6 < 0 ||
    market.yesAskE6 > 1_000_000 ||
    market.yesBidE6 > market.yesAskE6
  ) {
    reasons.push("invalid-price");
  } else if (market.yesAskE6 - market.yesBidE6 > policy.maxYesSpreadE6) {
    reasons.push("spread-too-wide");
  }
  if ((market.volumeUsdE6 ?? 0n) < policy.minVolumeUsdE6) reasons.push("volume-too-low");
  return { eligible: reasons.length === 0, reasons };
}

export type CatalogEntry = {
  key: string;
  market: ExternalMarket;
  eligibility: Eligibility;
};

export function buildCatalog(
  markets: ExternalMarket[],
  now: number,
  policy: EligibilityPolicy = DEFAULT_ELIGIBILITY_POLICY,
): CatalogEntry[] {
  return markets
    .map((market) => ({
      key: `${market.provider}:${market.providerMarketId}`,
      market,
      eligibility: assessEligibility(market, now, policy),
    }))
    .sort((left, right) => right.market.closeTime - left.market.closeTime);
}

