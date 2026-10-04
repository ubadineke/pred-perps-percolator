import type { ExternalMarket, MarketFilters } from "../../../packages/provider-adapter/src/index.ts";
import { PantaPredictionSource } from "../../../packages/provider-adapter/src/index.ts";

export type ProviderCatalogStatus = {
  provider: "panta";
  network: "solana-mainnet";
  updatedAt: number;
  stale: boolean;
  error?: string;
};

export class PantaCatalogService {
  readonly source: PantaPredictionSource;
  readonly ttlMs: number;
  readonly maxPages: number;
  readonly detailConcurrency: number;
  #markets: ExternalMarket[] = [];
  #updatedAt = 0;
  #error?: string;
  #refresh?: Promise<void>;

  constructor(source: PantaPredictionSource, options: { ttlMs?: number; maxPages?: number; detailConcurrency?: number } = {}) {
    this.source = source;
    this.ttlMs = options.ttlMs ?? 30_000;
    this.maxPages = options.maxPages ?? 5;
    this.detailConcurrency = options.detailConcurrency ?? 3;
  }

  get status(): ProviderCatalogStatus {
    return {
      provider: "panta",
      network: "solana-mainnet",
      updatedAt: this.#updatedAt,
      stale: !this.#updatedAt || Date.now() - this.#updatedAt > this.ttlMs * 2 || Boolean(this.#error),
      ...(this.#error ? { error: this.#error } : {}),
    };
  }

  async markets(filters: MarketFilters = {}): Promise<ExternalMarket[]> {
    await this.#ensureFresh();
    const query = filters.query?.trim().toLowerCase();
    return this.#markets
      .filter((market) => !filters.status || market.status === filters.status)
      .filter((market) => !filters.category || market.category === filters.category)
      .filter((market) => !query || `${market.title} ${market.description}`.toLowerCase().includes(query))
      .slice(0, filters.limit ?? this.#markets.length)
      .map((market) => this.#publicMarket(market));
  }

  async market(id: string): Promise<ExternalMarket> {
    const detailed = await this.source.getMarket(id);
    const index = this.#markets.findIndex((market) => market.providerMarketId === id);
    if (index >= 0) this.#markets[index] = detailed;
    else this.#markets.push(detailed);
    return this.#publicMarket(detailed);
  }

  async refresh(): Promise<void> {
    if (this.#refresh) return this.#refresh;
    this.#refresh = this.#load().finally(() => { this.#refresh = undefined; });
    return this.#refresh;
  }

  async #ensureFresh(): Promise<void> {
    if (!this.#updatedAt || Date.now() - this.#updatedAt > this.ttlMs) await this.refresh();
  }

  async #load(): Promise<void> {
    try {
      const markets: ExternalMarket[] = [];
      let cursor: string | undefined;
      for (let pageIndex = 0; pageIndex < this.maxPages; pageIndex += 1) {
        const page = await this.source.listMarketPage({ cursor, limit: 20 });
        markets.push(...page.markets);
        cursor = page.nextCursor;
        if (!cursor) break;
      }
      // Panta's catalog endpoint intentionally returns discovery metadata only.
      // Hydrate open rows through the documented per-market endpoint, which is
      // where current probability and complete valuation status are exposed.
      const hydrated = [...markets];
      let detailCursor = 0;
      const workers = Array.from(
        { length: Math.min(this.detailConcurrency, hydrated.length) },
        async () => {
          while (detailCursor < hydrated.length) {
            const index = detailCursor++;
            if (hydrated[index]?.status !== "open") continue;
            try {
              hydrated[index] = await this.source.getMarket(hydrated[index]!.providerMarketId);
            } catch {
              // Discovery remains useful when a single RPC-backed detail lookup
              // is unavailable. Admission still rejects rows without a price.
            }
          }
        },
      );
      await Promise.all(workers);
      this.#markets = hydrated;
      this.#updatedAt = Date.now();
      this.#error = undefined;
    } catch (error) {
      this.#error = error instanceof Error ? error.message : String(error);
      if (!this.#markets.length) throw error;
    }
  }

  #publicMarket(market: ExternalMarket): ExternalMarket {
    const { raw: _raw, ...safe } = market;
    return structuredClone(safe);
  }
}
