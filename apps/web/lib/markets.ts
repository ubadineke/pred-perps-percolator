export type MarketProvider = "panta" | "jupiter" | "unknown";
export type MarketLifecycle = "Active" | "Restricted" | "Reduce only" | "Locked" | "Resolved" | "Unknown";

export type MarketStats = {
  change24hCents: number | null;
  volume24hUsd: number;
  openInterestContracts: number;
  openInterestUsd: number;
};

export type Market = {
  /** Oracle record address; also the URL slug. */
  slug: string;
  address: string;
  question: string;
  /** Two-letter mark for avatars, derived from the question. */
  initials: string;
  provider: MarketProvider;
  providerLabel: string;
  providerMarketId: string;
  lifecycle: MarketLifecycle;
  status: number;
  /** Protected mark, in cents. */
  mark: number;
  /** Last source (Panta) index, in cents. */
  index: number;
  /** True when the source index has not updated recently (source paused or stale). */
  indexStale: boolean;
  /** Unix seconds of the last oracle observation. */
  oracleUpdatedAt: number;
  /** Unix seconds when the event closes. */
  closeTime: number;
  marketId: string;
  assetIndex: number;
  stats: MarketStats;
};

export type ApiMarket = {
  address: string;
  provider?: string;
  providerMarketId: string;
  title: string;
  rules: string;
  slot: number;
  assetIndex: number;
  marketId: string;
  status: number;
  markE6: string;
  indexE6: string;
  closeTime: string;
  oracleUpdatedAt: string;
  stats?: MarketStats;
};

const INDEX_STALE_AFTER_SECONDS = 10 * 60;
const EMPTY_STATS: MarketStats = { change24hCents: null, volume24hUsd: 0, openInterestContracts: 0, openInterestUsd: 0 };

const provider = (value?: string): MarketProvider =>
  value?.toLowerCase() === "panta" ? "panta" : value?.toLowerCase() === "jupiter" ? "jupiter" : "unknown";

const lifecycle = (status: number): MarketLifecycle =>
  (["Unknown", "Active", "Restricted", "Reduce only", "Locked", "Resolved"][status] ?? "Unknown") as MarketLifecycle;

const STOP_WORDS = new Set(["will", "the", "a", "an", "of", "to", "in", "on", "by", "be", "with", "or", "and", "at", "for"]);

/** "Manchester United will win…" → "MU"; "Saka 7+ points, GW6" → "S7". */
export function initialsFor(question: string): string {
  const words = question
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word.toLowerCase()));
  const letters = words.slice(0, 2).map((word) => word[0]!.toUpperCase());
  return letters.join("") || "M";
}

export function toMarket(x: ApiMarket): Market {
  const question = x.title.trim() || `Imported prediction market #${x.marketId}`;
  const source = provider(x.provider);
  const oracleUpdatedAt = Number(x.oracleUpdatedAt) || 0;
  return {
    slug: x.address,
    address: x.address,
    question,
    initials: initialsFor(question),
    provider: source,
    providerLabel: source === "unknown" ? "External" : source[0].toUpperCase() + source.slice(1),
    providerMarketId: x.providerMarketId,
    lifecycle: lifecycle(x.status),
    status: x.status,
    mark: Number(x.markE6) / 10_000,
    index: Number(x.indexE6) / 10_000,
    indexStale: oracleUpdatedAt > 0 && Date.now() / 1000 - oracleUpdatedAt > INDEX_STALE_AFTER_SECONDS,
    oracleUpdatedAt,
    closeTime: Number(x.closeTime) || 0,
    marketId: x.marketId,
    assetIndex: x.assetIndex,
    stats: x.stats ?? EMPTY_STATS,
  };
}

/** Markets that accept new risk (Active or Restricted). */
export const isTradable = (market: Pick<Market, "status">) => market.status === 1 || market.status === 2;
