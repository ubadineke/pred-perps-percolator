export type ProviderName = string;
export type MarketStatus = "open" | "locked" | "resolved" | "cancelled" | "unknown";
export type BinaryResult = "YES" | "NO" | "VOID" | null;

export type MarketFilters = {
  status?: MarketStatus;
  cursor?: string;
  limit?: number;
  category?: string;
  query?: string;
};

export type ExternalMarket = {
  provider: ProviderName;
  providerMarketId: string;
  providerEventId?: string;
  title: string;
  description: string;
  rules: string;
  yesAssetId?: string;
  noAssetId?: string;
  openTime: number;
  closeTime: number;
  resolveTime?: number;
  status: MarketStatus;
  result: BinaryResult;
  yesBidE6?: number;
  yesAskE6?: number;
  noBidE6?: number;
  noAskE6?: number;
  volumeUsdE6?: bigint;
  liquidityUsdE6?: bigint;
  sourceUrl?: string;
  observedAt: number;
  raw: unknown;
};

export type ExternalOrderbook = {
  marketId: string;
  observedAt: number;
  yesBidE6?: number;
  yesAskE6?: number;
  noBidE6?: number;
  noAskE6?: number;
  yesBids: ExternalOrderbookLevel[];
  noBids: ExternalOrderbookLevel[];
};

export type ExternalOrderbookLevel = { priceE6: number; quantity: string };

export type ExternalTrade = {
  id: string;
  marketId: string;
  timestamp: number;
  outcome: "YES" | "NO";
  priceE6: number;
  sizeUsdE6?: bigint;
};

export type ExternalResolution = {
  marketId: string;
  status: MarketStatus;
  result: BinaryResult;
  resolvedAt?: number;
};
