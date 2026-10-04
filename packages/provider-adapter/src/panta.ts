import type { MarketSource } from "./market-source.ts";
import type {
  BinaryResult,
  ExternalMarket,
  ExternalOrderbook,
  ExternalResolution,
  ExternalTrade,
  MarketFilters,
  MarketStatus,
} from "./types.ts";

type Fetch = typeof globalThis.fetch;
type JsonRecord = Record<string, unknown>;

export type PantaPredictionSourceOptions = {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: Fetch;
  now?: () => number;
};

export type PantaMarketPage = {
  markets: ExternalMarket[];
  nextCursor?: string;
};

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function finite(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function epochMs(value: unknown): number | undefined {
  if (typeof value === "string" && value.trim() && !/^\d+(?:\.\d+)?$/.test(value.trim())) {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : undefined;
  }
  const parsed = finite(value);
  if (parsed === undefined || parsed < 0) return undefined;
  return parsed < 10_000_000_000 ? parsed * 1_000 : parsed;
}

function probabilityE6(value: unknown): number | undefined {
  const parsed = finite(value);
  if (parsed === undefined || parsed < 0 || parsed > 1) return undefined;
  return Math.round(parsed * 1_000_000);
}

function usdcE6(value: unknown): bigint | undefined {
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  const parsed = finite(value);
  if (parsed === undefined || parsed < 0) return undefined;
  return BigInt(Math.round(parsed * 1_000_000));
}

function statusOf(market: JsonRecord): MarketStatus {
  if (market.isCancelled === true || ["cancelled", "canceled", "void"].includes(String(market.status).toLowerCase())) return "cancelled";
  if (market.isResolved === true || market.resolved === true || ["resolved", "settled"].includes(String(market.status).toLowerCase())) return "resolved";
  const status = String(market.status ?? market.phase ?? "").toLowerCase();
  if (["open", "primary", "secondary", "secondary_active", "active"].includes(status)) return "open";
  if (["closed", "locked", "review", "pending_review", "settling"].includes(status)) return "locked";
  return "unknown";
}

function resultOf(market: JsonRecord): BinaryResult {
  if (!(market.isResolved === true || market.resolved === true)) return null;
  if (market.isCancelled === true) return "VOID";
  const explicit = String(market.result ?? market.outcome ?? market.winningOutcome ?? "").toUpperCase();
  if (explicit === "YES" || explicit === "NO" || explicit === "VOID") return explicit;
  if (market.yesWins === true) return "YES";
  if (market.yesWins === false) return "NO";
  const yesPrice = probabilityE6(market.yesPrice);
  const noPrice = probabilityE6(market.noPrice);
  if (yesPrice === 1_000_000 && noPrice === 0) return "YES";
  if (yesPrice === 0 && noPrice === 1_000_000) return "NO";
  return null;
}

export function normalizePantaMarket(value: unknown, observedAt = Date.now()): ExternalMarket {
  const market = record(value, "Panta market");
  const providerMarketId = text(market.marketId ?? market.eventPda ?? market.id);
  const title = text(market.title) ?? text(market.question) ?? text(market.description);
  const closeTime = epochMs(market.endTime);
  if (!providerMarketId || !title || closeTime === undefined) {
    throw new TypeError("Panta market is missing marketId, title/question, or endTime");
  }

  const yesPrice = probabilityE6(market.yesPrice);
  const noPrice = probabilityE6(market.noPrice);
  const complementary = yesPrice !== undefined && noPrice !== undefined
    && Math.abs(1_000_000 - yesPrice - noPrice) <= 2;
  const resolutionRule = text(market.resolutionRule) ?? "";
  const sources = Array.isArray(market.sources)
    ? market.sources.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : text(market.oracle)?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];

  return {
    provider: "panta",
    providerMarketId,
    category: text(market.category ?? market.Category),
    title,
    description: text(market.description) ?? "",
    rules: [resolutionRule, sources.length ? `Sources: ${sources.join(", ")}` : ""].filter(Boolean).join("\n\n"),
    yesAssetId: `${providerMarketId}:YES`,
    noAssetId: `${providerMarketId}:NO`,
    openTime: epochMs(market.createdAt ?? market.startTime) ?? 0,
    closeTime,
    resolveTime: epochMs(market.resolutionTime),
    status: statusOf(market),
    result: resultOf(market),
    // Panta's primary/secondary displayed price is an index observation, not an
    // executable two-sided book. Keep bid/ask absent so catalog admission cannot
    // mistake a point price for guaranteed liquidity.
    indexPriceE6: complementary ? yesPrice : undefined,
    volumeUsdE6: usdcE6(market.totalVolumeUsdcBase ?? market.volumeUsdcBase)
      ?? (market.totalVolumeUsdc !== undefined ? usdcE6(market.totalVolumeUsdc) : usdcE6(market.volumeUsdc))
      ?? usdcE6(market.volume ?? market.primaryVolume),
    providerPhase: text(market.phase ?? market.status),
    marketType: text(market.marketType),
    priceSource: text(market.priceSource),
    valuationStatus: text(market.valuationStatus),
    providerProgramId: text(market.programId),
    sourceNetwork: "solana-mainnet",
    sourceUrl: `https://panta.market/market/${providerMarketId}`,
    observedAt,
    raw: value,
  };
}

function items(value: unknown): { rows: unknown[]; nextCursor?: string } {
  const payload = record(value, "Panta markets response");
  const rows = Array.isArray(payload.items) ? payload.items : Array.isArray(payload.data) ? payload.data : undefined;
  if (!rows) throw new TypeError("Panta markets response does not contain items or data");
  return { rows, nextCursor: text(payload.nextCursor) };
}

function detail(value: unknown): unknown {
  const payload = record(value, "Panta market response");
  return payload.success === true && payload.data ? payload.data : value;
}

export class PantaUnsupportedCapabilityError extends Error {
  constructor(capability: string) {
    super(`Panta API does not expose ${capability} through the documented market-data flow`);
    this.name = "PantaUnsupportedCapabilityError";
  }
}

export class PantaPredictionSource implements MarketSource {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetch: Fetch;
  readonly #now: () => number;
  readonly #productionEvents: boolean;

  constructor(options: PantaPredictionSourceOptions = {}) {
    this.#apiKey = options.apiKey ?? process.env.PANTA_API_KEY ?? "";
    this.#baseUrl = (options.baseUrl ?? process.env.PANTA_API_BASE_URL ?? "https://live-api.panta.market/api/v1").replace(/\/$/, "");
    this.#productionEvents = new URL(this.#baseUrl).hostname === "production-api.balr.fun";
    this.#fetch = options.fetchImpl ?? globalThis.fetch;
    this.#now = options.now ?? Date.now;
    if (!this.#apiKey) throw new Error("PANTA_API_KEY is required for Panta API calls");
  }

  async #json(path: string, query?: URLSearchParams): Promise<unknown> {
    const response = await this.#fetch(`${this.#baseUrl}${path}${query?.size ? `?${query}` : ""}`, {
      headers: { "X-Api-Key": this.#apiKey, accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Panta API ${response.status} for ${path}`);
    return response.json();
  }

  async listMarketPage(filters: MarketFilters = {}): Promise<PantaMarketPage> {
    const query = new URLSearchParams();
    if (filters.cursor) query.set("cursor", filters.cursor);
    if (filters.limit) query.set("limit", String(filters.limit));
    if (filters.category) query.set("category", filters.category);
    if (filters.status) query.set("status", filters.status);
    if (filters.query) query.set("search", filters.query);
    const page = items(await this.#json(this.#productionEvents ? "/events" : "/markets/", this.#productionEvents ? undefined : query));
    const observedAt = this.#now();
    const markets: ExternalMarket[] = [];
    for (const value of page.rows) {
      try {
        const market = normalizePantaMarket(value, observedAt);
        if (filters.status && market.status !== filters.status) continue;
        if (filters.category && market.category?.toLowerCase() !== filters.category.toLowerCase()) continue;
        if (filters.query && !`${market.title} ${market.description}`.toLowerCase().includes(filters.query.toLowerCase())) continue;
        markets.push(market);
      } catch (error) {
        // A catalog page can contain legacy or partially-created rows. Do not
        // let one invalid summary hide every sound market; getMarket remains
        // strict and admission still requires a valid detailed record.
        if (!(error instanceof TypeError)) throw error;
      }
    }
    return {
      markets: filters.limit ? markets.slice(0, filters.limit) : markets,
      nextCursor: page.nextCursor,
    };
  }

  async listMarkets(filters: MarketFilters = {}): Promise<ExternalMarket[]> {
    return (await this.listMarketPage(filters)).markets;
  }

  async getMarket(id: string): Promise<ExternalMarket> {
    const path = this.#productionEvents ? `/events/${encodeURIComponent(id)}` : `/markets/${encodeURIComponent(id)}/`;
    return normalizePantaMarket(detail(await this.#json(path)), this.#now());
  }

  async getOrderbook(_id: string): Promise<ExternalOrderbook> {
    throw new PantaUnsupportedCapabilityError("an executable order book");
  }

  async getTrades(id: string): Promise<ExternalTrade[]> {
    const payload = await this.#json(`/markets/${encodeURIComponent(id)}/trades/`);
    const rows = Array.isArray(payload) ? payload : items(payload).rows;
    return rows.map((value, index) => {
      const trade = record(value, "Panta trade");
      const outcome = String(trade.outcome ?? trade.side ?? "").toUpperCase();
      const priceE6 = probabilityE6(trade.price ?? trade.yesPrice);
      const timestamp = epochMs(trade.timestamp ?? trade.createdAt);
      if (!["YES", "NO"].includes(outcome) || priceE6 === undefined || timestamp === undefined) {
        throw new TypeError("Panta trade is missing outcome, price, or timestamp");
      }
      return {
        id: text(trade.id ?? trade.signature ?? trade.transactionHash) ?? `${id}:${index}`,
        marketId: id,
        timestamp,
        outcome: outcome as "YES" | "NO",
        priceE6,
        sizeUsdE6: usdcE6(trade.amountUsdcBase ?? trade.amountUsdc),
      };
    });
  }

  async getResolution(id: string): Promise<ExternalResolution> {
    const market = await this.getMarket(id);
    return {
      marketId: id,
      status: market.status,
      result: market.result,
      resolvedAt: market.status === "resolved" ? market.resolveTime ?? market.observedAt : undefined,
    };
  }
}
