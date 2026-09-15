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

export type JupiterPredictionSourceOptions = {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: Fetch;
  now?: () => number;
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function finite(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : undefined;
}

function epochMs(value: unknown): number | undefined {
  const number = finite(value);
  if (number !== undefined) return number < 10_000_000_000 ? number * 1_000 : number;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function probabilityE6(value: unknown): number | undefined {
  const number = finite(value);
  if (number === undefined || number < 0) return undefined;
  if (number <= 1) return Math.round(number * 1_000_000);
  if (Number.isInteger(number) && number <= 1_000_000) return number;
  return undefined;
}

function usdE6(value: unknown): bigint | undefined {
  const number = finite(value);
  if (number === undefined || number < 0) return undefined;
  return BigInt(Math.round(number * 1_000_000));
}

function normalizeStatus(value: unknown): MarketStatus {
  const status = textValue(value).toLowerCase();
  if (["open", "active", "trading"].includes(status)) return "open";
  if (["closed", "locked", "settling"].includes(status)) return "locked";
  if (["resolved", "settled"].includes(status)) return "resolved";
  if (["cancelled", "canceled", "void"].includes(status)) return "cancelled";
  return "unknown";
}

function normalizeResult(value: unknown): BinaryResult {
  const result = textValue(value).toUpperCase();
  if (["YES", "1", "TRUE"].includes(result)) return "YES";
  if (["NO", "0", "FALSE"].includes(result)) return "NO";
  if (["VOID", "CANCELLED", "CANCELED"].includes(result)) return "VOID";
  return null;
}

export function normalizeJupiterMarket(value: unknown, observedAt = Date.now()): ExternalMarket {
  const market = record(value, "Jupiter market");
  const metadata = record(market.metadata ?? {}, "Jupiter market metadata");
  const pricing = record(market.pricing ?? {}, "Jupiter market pricing");
  const clobTokenIds = Array.isArray(market.clobTokenIds) ? market.clobTokenIds : [];
  const providerMarketId = textValue(market.marketId ?? market.id);
  const title = textValue(metadata.title ?? market.title);
  const closeTime = epochMs(metadata.closeTime ?? market.closeTime);

  if (!providerMarketId || !title || closeTime === undefined) {
    throw new TypeError("Jupiter market is missing marketId, title, or closeTime");
  }

  return {
    provider: "jupiter",
    providerMarketId,
    providerEventId: textValue(market.eventId) || undefined,
    title,
    description: textValue(metadata.description ?? market.description),
    rules: [metadata.rulesPrimary ?? market.rulesPrimary, metadata.rulesSecondary ?? market.rulesSecondary]
      .filter((item) => typeof item === "string" && item).join("\n\n"),
    yesAssetId: textValue(market.yesMint ?? market.yesAssetId ?? clobTokenIds[0]) || undefined,
    noAssetId: textValue(market.noMint ?? market.noAssetId ?? clobTokenIds[1]) || undefined,
    openTime: epochMs(metadata.openTime ?? market.openTime) ?? 0,
    closeTime,
    resolveTime: epochMs(market.resolveAt ?? metadata.resolveAt),
    status: normalizeStatus(metadata.status ?? market.status),
    result: normalizeResult(metadata.result ?? market.result),
    yesBidE6: probabilityE6(pricing.sellYesPriceUsd),
    yesAskE6: probabilityE6(pricing.buyYesPriceUsd),
    noBidE6: probabilityE6(pricing.sellNoPriceUsd),
    noAskE6: probabilityE6(pricing.buyNoPriceUsd),
    volumeUsdE6: usdE6(pricing.volume ?? market.volume),
    liquidityUsdE6: usdE6(pricing.liquidity ?? market.liquidity),
    sourceUrl: textValue(metadata.url ?? market.url) || undefined,
    observedAt,
    raw: value,
  };
}

function eventPayload(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const payload = record(value, "Jupiter events response");
  for (const key of ["events", "data", "items"]) {
    if (Array.isArray(payload[key])) return payload[key] as unknown[];
  }
  throw new TypeError("Jupiter events response does not contain an events array");
}

function eventMarkets(value: unknown): unknown[] {
  const event = record(value, "Jupiter event");
  if (!Array.isArray(event.markets)) return [];
  return event.markets.map((market) => ({
    ...record(market, "Jupiter event market"),
    eventId: textValue(event.eventId),
  }));
}

function orderbookLevels(value: unknown, dollars: boolean): { priceE6: number; quantity: string }[] {
  if (!Array.isArray(value)) return [];
  const levels = value.flatMap((item) => {
    if (!Array.isArray(item) || item.length < 2) return [];
    const rawPrice = finite(item[0]);
    if (rawPrice === undefined) return [];
    const priceE6 = dollars ? probabilityE6(rawPrice) : Math.round(rawPrice * 10_000);
    if (priceE6 === undefined || priceE6 < 0 || priceE6 > 1_000_000) return [];
    return [{ priceE6, quantity: String(item[1]) }];
  });
  return levels.sort((left, right) => right.priceE6 - left.priceE6);
}

export class UnsupportedProviderCapabilityError extends Error {
  constructor(capability: string) {
    super(`Jupiter Prediction API does not expose ${capability} as a public market-wide feed`);
    this.name = "UnsupportedProviderCapabilityError";
  }
}

export class JupiterPredictionSource implements MarketSource {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetch: Fetch;
  readonly #now: () => number;

  constructor(options: JupiterPredictionSourceOptions = {}) {
    this.#apiKey = options.apiKey ?? process.env.JUPITER_API_KEY ?? "";
    this.#baseUrl = (options.baseUrl ?? process.env.JUPITER_PREDICTION_BASE_URL ?? "https://api.jup.ag/prediction/v1").replace(/\/$/, "");
    this.#fetch = options.fetchImpl ?? globalThis.fetch;
    this.#now = options.now ?? Date.now;
    if (!this.#apiKey) throw new Error("JUPITER_API_KEY is required for live Jupiter Prediction API calls");
  }

  async #json(path: string, query?: URLSearchParams): Promise<unknown> {
    const url = `${this.#baseUrl}${path}${query?.size ? `?${query}` : ""}`;
    const response = await this.#fetch(url, { headers: { "x-api-key": this.#apiKey, accept: "application/json" } });
    if (!response.ok) throw new Error(`Jupiter Prediction API ${response.status} for ${path}`);
    return response.json();
  }

  async listMarkets(filters: MarketFilters = {}): Promise<ExternalMarket[]> {
    const query = new URLSearchParams();
    query.set("includeMarkets", "true");
    if (filters.category) query.set("category", filters.category);
    if (filters.status === "open") query.set("filter", "live");
    const start = filters.cursor ? Number.parseInt(filters.cursor, 10) : 0;
    if (!Number.isSafeInteger(start) || start < 0) throw new TypeError("cursor must be a non-negative numeric start index");
    query.set("start", String(start));
    query.set("end", String(start + (filters.limit ?? 20)));
    const path = filters.query ? "/events/search" : "/events";
    if (filters.query) {
      query.set("query", filters.query);
      query.set("limit", String(filters.limit ?? 20));
    }
    const payload = await this.#json(path, query);
    return eventPayload(payload)
      .flatMap(eventMarkets)
      .map((market) => normalizeJupiterMarket(market, this.#now()));
  }

  async getMarket(id: string): Promise<ExternalMarket> {
    return normalizeJupiterMarket(await this.#json(`/markets/${encodeURIComponent(id)}`), this.#now());
  }

  async getOrderbook(id: string): Promise<ExternalOrderbook> {
    const payload = record(await this.#json(`/orderbook/${encodeURIComponent(id)}`), "Jupiter orderbook");
    const yesBids = orderbookLevels(payload.yes_dollars, true).length
      ? orderbookLevels(payload.yes_dollars, true)
      : orderbookLevels(payload.yes, false);
    const noBids = orderbookLevels(payload.no_dollars, true).length
      ? orderbookLevels(payload.no_dollars, true)
      : orderbookLevels(payload.no, false);
    const yesBidE6 = yesBids[0]?.priceE6;
    const noBidE6 = noBids[0]?.priceE6;
    return {
      marketId: id,
      observedAt: this.#now(),
      yesBidE6,
      yesAskE6: noBidE6 === undefined ? undefined : 1_000_000 - noBidE6,
      noBidE6,
      noAskE6: yesBidE6 === undefined ? undefined : 1_000_000 - yesBidE6,
      yesBids,
      noBids,
    };
  }

  async getTrades(_id: string): Promise<ExternalTrade[]> {
    throw new UnsupportedProviderCapabilityError("a public per-market trade tape");
  }

  async getResolution(id: string): Promise<ExternalResolution> {
    const market = await this.getMarket(id);
    return {
      marketId: market.providerMarketId,
      status: market.status,
      result: market.result,
      resolvedAt: market.status === "resolved" ? market.resolveTime ?? market.observedAt : undefined,
    };
  }
}
