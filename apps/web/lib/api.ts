import { toMarket, type ApiMarket, type Market } from "./markets";

// Client for the Moxie indexer API. Used from server components (MOXIE_API_URL) and from the browser
// (NEXT_PUBLIC_MOXIE_API_URL, defaulting to the local indexer).

const base = () => process.env.MOXIE_API_URL ?? process.env.NEXT_PUBLIC_MOXIE_API_URL ?? "http://127.0.0.1:8787";

/** The indexer answered, but it does not know this account (e.g. a wallet with no portfolio yet). */
export class NotIndexedError extends Error {
  constructor(path: string) {
    super(`Not indexed: ${path}`);
    this.name = "NotIndexedError";
  }
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${base()}${path}`, { cache: "no-store" });
  if (response.status === 404) throw new NotIndexedError(path);
  if (!response.ok) throw new Error("The Moxie indexer is unavailable.");
  return response.json() as Promise<T>;
}

export async function getMarkets(): Promise<Market[]> {
  return (await request<ApiMarket[]>("/v1/markets")).map(toMarket);
}

export async function getMarket(address: string): Promise<Market> {
  return toMarket(await request<ApiMarket>(`/v1/markets/${encodeURIComponent(address)}`));
}

export type ApiPosition = { slot: number; assetIndex: number; marketId: string; side: "long" | "short"; sizeQ: string; entryNotional: string; stale: boolean };
export type ApiHealth = { valid: boolean; equity: string; initialRequirement: string; maintenanceRequirement: string; liquidationDeficit: string; worstCaseLoss: string };
export type ApiPortfolio = {
  address: string;
  owner: string;
  slot: number;
  capital: string;
  pnl: string;
  portfolioId: string;
  positionEpoch: string;
  sequence: string;
  health: ApiHealth;
  positions: ApiPosition[];
};

export const getPortfolio = (address: string) => request<ApiPortfolio>(`/v1/portfolios/${encodeURIComponent(address)}`);
export const getPortfolioByOwner = (ownerHex: string) => request<ApiPortfolio>(`/v1/owners/${encodeURIComponent(ownerHex)}/portfolio`);

export type ApiTrade = { signature: string; instructionIndex: number; slot: number; blockTime?: number; kind: "trade"; marketId?: string; portfolio?: string; data: Record<string, string> };
export const getMarketTrades = (address: string) => request<ApiTrade[]>(`/v1/markets/${encodeURIComponent(address)}/trades`);
export const getPortfolioTransactions = (address: string) => request<ApiTrade[]>(`/v1/portfolios/${encodeURIComponent(address)}/transactions`);

export type ApiPantaMarket = {
  provider: "panta";
  providerMarketId: string;
  category?: string;
  title: string;
  description: string;
  rules: string;
  closeTime: number;
  status: "open" | "locked" | "resolved" | "cancelled" | "unknown";
  indexPriceE6?: number;
  volumeUsdE6?: string;
  providerPhase?: string;
  valuationStatus?: string;
  sourceNetwork?: "solana-mainnet" | "solana-devnet" | "unknown";
  sourceUrl?: string;
  observedAt: number;
};
export type ApiProviderStatus = { provider: "panta"; network: "solana-mainnet"; updatedAt: number; stale: boolean; error?: string };
export const getPantaMarkets = (limit = 12) => request<ApiPantaMarket[]>(`/v1/providers/panta/markets?limit=${limit}`);
export const getPantaStatus = () => request<ApiProviderStatus>("/v1/providers/panta/status");
export const getPantaMarket = (id: string) => request<ApiPantaMarket>(`/v1/providers/panta/markets/${encodeURIComponent(id)}`);

export type ChartRange = "1h" | "1d" | "1w" | "all";
export type ApiChartPoint = { time: number; value: number };
export type ApiChartFill = { time: number; price: number; size: number; side: "long" | "short"; portfolio?: string; signature: string };
export type ApiChartCandle = { time: number; open: number; high: number; low: number; close: number; volume: number };
export type ApiMarketChart = { range: ChartRange; bucketSeconds: number; mark: ApiChartPoint[]; index: ApiChartPoint[]; fills: ApiChartFill[]; candles: ApiChartCandle[] };
export const getMarketChart = (address: string, range: ChartRange) => request<ApiMarketChart>(`/v1/markets/${encodeURIComponent(address)}/chart?range=${range}`);
