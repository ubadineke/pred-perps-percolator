import type {
  ExternalMarket,
  ExternalOrderbook,
  ExternalResolution,
  ExternalTrade,
  MarketFilters,
} from "./types.ts";

export interface MarketSource {
  listMarkets(filters?: MarketFilters): Promise<ExternalMarket[]>;
  getMarket(id: string): Promise<ExternalMarket>;
  getOrderbook(id: string): Promise<ExternalOrderbook>;
  getTrades(id: string): Promise<ExternalTrade[]>;
  getResolution(id: string): Promise<ExternalResolution>;
}

