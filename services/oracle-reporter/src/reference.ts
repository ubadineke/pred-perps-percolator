export type Level = { priceE6: number; sizeE6: bigint };
export type ProbabilityBook = { yesBids: Level[]; yesAsks: Level[]; observedAtMs: number };
export type ReferencePolicy = {
  maxAgeMs: number;
  degradedAgeMs: number;
  maxSpreadE6: number;
  degradedSpreadE6: number;
  minDepthE6: bigint;
  impactSizeE6: bigint;
  twapWindowMs: number;
  medianWindowSize: number;
  epsilonE6: number;
};
export type Sample = { probabilityE6: number; observedAtMs: number };
export type OracleHealth = "healthy" | "degraded";
export type Reference = {
  probabilityE6: number;
  rawImpactMidpointE6: number;
  impactBidE6: number;
  impactAskE6: number;
  spreadE6: number;
  bidDepthE6: bigint;
  askDepthE6: bigint;
  observedAtMs: number;
  health: OracleHealth;
};

export class UnsafeReferenceError extends Error {}

export function calculateReference(
  book: ProbabilityBook,
  history: readonly Sample[],
  policy: ReferencePolicy,
  now: number,
): Reference {
  validatePolicy(policy);
  const age = now - book.observedAtMs;
  if (age < 0 || age > policy.maxAgeMs) throw new UnsafeReferenceError("stale-book");
  const bids = normalizeLevels(book.yesBids, "bid", policy.epsilonE6);
  const asks = normalizeLevels(book.yesAsks, "ask", policy.epsilonE6);
  if (bids.length === 0 || asks.length === 0) throw new UnsafeReferenceError("empty-book");
  if (bids[0].priceE6 > asks[0].priceE6) throw new UnsafeReferenceError("crossed-book");
  const bidDepthE6 = totalDepth(bids);
  const askDepthE6 = totalDepth(asks);
  if (bidDepthE6 < policy.minDepthE6 || askDepthE6 < policy.minDepthE6) {
    throw new UnsafeReferenceError("depth-too-low");
  }
  const impactBidE6 = impactPrice(bids, policy.impactSizeE6);
  const impactAskE6 = impactPrice(asks, policy.impactSizeE6);
  const spreadE6 = impactAskE6 - impactBidE6;
  if (spreadE6 < 0) throw new UnsafeReferenceError("crossed-impact-book");
  if (spreadE6 > policy.maxSpreadE6) throw new UnsafeReferenceError("spread-too-wide");

  const rawImpactMidpointE6 = Math.floor((impactBidE6 + impactAskE6) / 2);
  const windowStart = now - policy.twapWindowMs;
  const recent = history
    .filter((sample) => sample.observedAtMs >= windowStart && sample.observedAtMs <= now)
    .sort((left, right) => left.observedAtMs - right.observedAtMs);
  const filterValues = [
    ...recent.slice(-Math.max(0, policy.medianWindowSize - 1)).map((sample) => sample.probabilityE6),
    rawImpactMidpointE6,
  ];
  const filteredCurrent = medianFloor(filterValues);
  const probabilityE6 = clampLive(
    timeWeightedAverage(
      [...recent, { probabilityE6: filteredCurrent, observedAtMs: book.observedAtMs }],
      windowStart,
      now,
    ),
    policy.epsilonE6,
  );
  const health: OracleHealth = age > policy.degradedAgeMs || spreadE6 > policy.degradedSpreadE6
    ? "degraded"
    : "healthy";
  return {
    probabilityE6,
    rawImpactMidpointE6,
    impactBidE6,
    impactAskE6,
    spreadE6,
    bidDepthE6,
    askDepthE6,
    observedAtMs: book.observedAtMs,
    health,
  };
}

function validatePolicy(policy: ReferencePolicy): void {
  if (
    policy.maxAgeMs <= 0 || policy.degradedAgeMs < 0 || policy.degradedAgeMs > policy.maxAgeMs ||
    policy.maxSpreadE6 <= 0 || policy.degradedSpreadE6 < 0 ||
    policy.degradedSpreadE6 > policy.maxSpreadE6 || policy.minDepthE6 <= 0n ||
    policy.impactSizeE6 <= 0n || policy.impactSizeE6 > policy.minDepthE6 ||
    policy.twapWindowMs <= 0 || policy.medianWindowSize <= 0 ||
    policy.epsilonE6 <= 0 || policy.epsilonE6 >= 500_000
  ) throw new TypeError("invalid-reference-policy");
}

function normalizeLevels(levels: Level[], side: "bid" | "ask", epsilonE6: number): Level[] {
  return levels
    .filter((level) => Number.isSafeInteger(level.priceE6) && level.sizeE6 > 0n)
    .map((level) => {
      if (level.priceE6 < epsilonE6 || level.priceE6 > 1_000_000 - epsilonE6) {
        throw new UnsafeReferenceError("invalid-price");
      }
      return level;
    })
    .sort((left, right) => side === "bid" ? right.priceE6 - left.priceE6 : left.priceE6 - right.priceE6);
}

function impactPrice(levels: readonly Level[], targetSizeE6: bigint): number {
  let remaining = targetSizeE6;
  let weighted = 0n;
  for (const level of levels) {
    const fill = level.sizeE6 < remaining ? level.sizeE6 : remaining;
    weighted += BigInt(level.priceE6) * fill;
    remaining -= fill;
    if (remaining === 0n) break;
  }
  if (remaining !== 0n) throw new UnsafeReferenceError("impact-depth-too-low");
  return Number(weighted / targetSizeE6);
}

function totalDepth(levels: readonly Level[]): bigint {
  return levels.reduce((total, level) => total + level.sizeE6, 0n);
}

function medianFloor(values: readonly number[]): number {
  if (values.length === 0) throw new UnsafeReferenceError("empty-filter-window");
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : Math.floor((sorted[middle - 1] + sorted[middle]) / 2);
}

function timeWeightedAverage(samples: readonly Sample[], start: number, end: number): number {
  if (end <= start) throw new TypeError("invalid-twap-window");
  const ordered = [...samples]
    .filter((sample) => sample.observedAtMs <= end)
    .sort((left, right) => left.observedAtMs - right.observedAtMs);
  if (ordered.length === 0) throw new UnsafeReferenceError("empty-twap-window");
  let active = ordered.findLast((sample) => sample.observedAtMs <= start) ?? ordered[0];
  let cursor = start;
  let weighted = 0n;
  let duration = 0n;
  for (const sample of ordered) {
    const timestamp = Math.max(start, Math.min(end, sample.observedAtMs));
    if (timestamp > cursor) {
      const elapsed = BigInt(timestamp - cursor);
      weighted += BigInt(active.probabilityE6) * elapsed;
      duration += elapsed;
      cursor = timestamp;
    }
    active = sample;
  }
  if (cursor < end) {
    const elapsed = BigInt(end - cursor);
    weighted += BigInt(active.probabilityE6) * elapsed;
    duration += elapsed;
  }
  return duration === 0n ? active.probabilityE6 : Number(weighted / duration);
}

function clampLive(value: number, epsilonE6: number): number {
  return Math.max(epsilonE6, Math.min(1_000_000 - epsilonE6, value));
}
