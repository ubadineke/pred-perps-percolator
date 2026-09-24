export type ProviderResolution = {
  marketId: string;
  outcome: "YES" | "NO";
  finalized: boolean;
  disputed: boolean;
  observedAtMs: number;
};

export type ResolutionPolicy = {
  expectedMarketId: string;
  closeTimeMs: number;
  maxAgeMs: number;
};

export type FinalResolution = {
  outcome: 0 | 1;
  sourceTimestamp: bigint;
};

export class UnsafeResolutionError extends Error {}

export function validateFinalResolution(
  observation: ProviderResolution,
  policy: ResolutionPolicy,
  nowMs: number,
): FinalResolution {
  if (!policy.expectedMarketId || policy.maxAgeMs <= 0 || policy.closeTimeMs <= 0) {
    throw new TypeError("invalid-resolution-policy");
  }
  if (observation.marketId !== policy.expectedMarketId) throw new UnsafeResolutionError("market-identity-mismatch");
  if (!observation.finalized) throw new UnsafeResolutionError("result-not-final");
  if (observation.disputed) throw new UnsafeResolutionError("result-disputed");
  if (observation.observedAtMs < policy.closeTimeMs) throw new UnsafeResolutionError("result-before-close");
  const age = nowMs - observation.observedAtMs;
  if (age < 0 || age > policy.maxAgeMs) throw new UnsafeResolutionError("stale-result");
  return {
    outcome: observation.outcome === "YES" ? 1 : 0,
    sourceTimestamp: BigInt(Math.floor(observation.observedAtMs / 1_000)),
  };
}
