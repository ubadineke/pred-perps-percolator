import { createHash } from "node:crypto";
import {
  assessEligibility,
  type Eligibility,
  type EligibilityPolicy,
  type ExternalMarket,
} from "../../provider-adapter/src/index.ts";

export type CatalogState =
  | "REFERENCE_ONLY"
  | "ELIGIBLE_FOR_PERP"
  | "PERP_ACTIVE"
  | "PERP_PAUSED"
  | "RESOLVED";

export type CatalogRecord = {
  key: string;
  market: ExternalMarket;
  state: CatalogState;
  eligibility: Eligibility;
  rulesHash: string;
  activatedRulesHash?: string;
  stale: boolean;
  lastRefreshError?: string;
};

export class ActivatedRulesChangedError extends Error {
  constructor(key: string) {
    super(`activated market ${key} returned different resolution rules`);
    this.name = "ActivatedRulesChangedError";
  }
}

export function hashRules(market: ExternalMarket): string {
  return createHash("sha256")
    .update(`${market.provider}\0${market.providerMarketId}\0${market.rules}`)
    .digest("hex");
}

export class MarketCatalog {
  readonly #records = new Map<string, CatalogRecord>();
  readonly policy: EligibilityPolicy;
  readonly now: () => number;

  constructor(
    policy: EligibilityPolicy,
    now: () => number = Date.now,
  ) {
    this.policy = policy;
    this.now = now;
  }

  ingest(markets: ExternalMarket[]): CatalogRecord[] {
    return markets.map((market) => {
      const key = `${market.provider}:${market.providerMarketId}`;
      const existing = this.#records.get(key);
      const rulesHash = hashRules(market);
      if (existing?.activatedRulesHash && existing.activatedRulesHash !== rulesHash) {
        existing.stale = true;
        existing.lastRefreshError = "provider returned rules that differ from the activated snapshot";
        throw new ActivatedRulesChangedError(key);
      }
      const eligibility = assessEligibility(market, this.now(), this.policy);
      const state = market.status === "resolved"
        ? "RESOLVED"
        : existing?.state === "PERP_ACTIVE" || existing?.state === "PERP_PAUSED"
          ? existing.state
          : eligibility.eligible ? "ELIGIBLE_FOR_PERP" : "REFERENCE_ONLY";
      const next: CatalogRecord = {
        key,
        market,
        state,
        eligibility,
        rulesHash,
        activatedRulesHash: existing?.activatedRulesHash,
        stale: false,
      };
      this.#records.set(key, next);
      return structuredClone(next);
    });
  }

  activate(key: string): CatalogRecord {
    const record = this.#required(key);
    if (!record.eligibility.eligible) throw new Error(`market ${key} is not eligible for activation`);
    record.state = "PERP_ACTIVE";
    record.activatedRulesHash = record.rulesHash;
    return structuredClone(record);
  }

  pause(key: string): CatalogRecord {
    const record = this.#required(key);
    if (record.state !== "PERP_ACTIVE") throw new Error(`market ${key} is not active`);
    record.state = "PERP_PAUSED";
    return structuredClone(record);
  }

  markRefreshFailed(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    for (const record of this.#records.values()) {
      record.stale = true;
      record.lastRefreshError = message;
    }
  }

  search(query = "", states?: CatalogState[]): CatalogRecord[] {
    const needle = query.trim().toLowerCase();
    return [...this.#records.values()]
      .filter((record) => !states || states.includes(record.state))
      .filter((record) => !needle || `${record.market.title} ${record.market.description}`.toLowerCase().includes(needle))
      .sort((left, right) => {
        const leftVolume = left.market.volumeUsdE6 ?? 0n;
        const rightVolume = right.market.volumeUsdE6 ?? 0n;
        return rightVolume === leftVolume ? 0 : rightVolume > leftVolume ? 1 : -1;
      })
      .map((record) => structuredClone(record));
  }

  get(key: string): CatalogRecord | undefined {
    const record = this.#records.get(key);
    return record ? structuredClone(record) : undefined;
  }

  #required(key: string): CatalogRecord {
    const record = this.#records.get(key);
    if (!record) throw new Error(`unknown catalog market ${key}`);
    return record;
  }
}
