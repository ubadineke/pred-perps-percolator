export type PercolatorMarketGroupConfig = {
  schemaVersion: 1;
  name: string;
  quote: { symbol: "USDC"; decimals: 6; mint: string | null };
  portfolio: { maxAssets: number; onePerOwner: boolean };
  activation: { mode: "admin-allowlist"; provider: "jupiter" };
  price: { decimals: 6; minimumE6: number; maximumE6: number; initialE6: number };
  risk: {
    maintenanceMarginBps: number;
    initialMarginBps: number;
    maxTradingFeeBps: number;
    tradeFeeBaseBps: number;
    liquidationFeeBps: number;
    maxPriceMoveBpsPerSlot: number;
    maxAbsFundingE9PerSlot: number;
  };
};

function integerIn(value: unknown, min: number, max: number, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    throw new TypeError(`${label} must be an integer in [${min}, ${max}]`);
  }
}

export function validateMarketGroupConfig(value: unknown): asserts value is PercolatorMarketGroupConfig {
  if (typeof value !== "object" || value === null) throw new TypeError("market group config must be an object");
  const config = value as Partial<PercolatorMarketGroupConfig>;
  if (config.schemaVersion !== 1) throw new TypeError("unsupported market group schemaVersion");
  if (config.quote?.symbol !== "USDC" || config.quote.decimals !== 6) throw new TypeError("V1 quote must be 6-decimal USDC");
  if (config.activation?.provider !== "jupiter" || config.activation.mode !== "admin-allowlist") throw new TypeError("V1 activation must be Jupiter admin-allowlist");
  integerIn(config.portfolio?.maxAssets, 1, 32, "portfolio.maxAssets");
  integerIn(config.price?.initialE6, 1, 999_999, "price.initialE6");
  integerIn(config.risk?.maintenanceMarginBps, 1, 10_000, "risk.maintenanceMarginBps");
  integerIn(config.risk?.initialMarginBps, config.risk!.maintenanceMarginBps, 10_000, "risk.initialMarginBps");
  integerIn(config.risk?.maxTradingFeeBps, 0, 10_000, "risk.maxTradingFeeBps");
  integerIn(config.risk?.tradeFeeBaseBps, 0, config.risk!.maxTradingFeeBps, "risk.tradeFeeBaseBps");
  integerIn(config.risk?.liquidationFeeBps, 0, 10_000, "risk.liquidationFeeBps");
  integerIn(config.risk?.maxPriceMoveBpsPerSlot, 1, 10_000, "risk.maxPriceMoveBpsPerSlot");
  integerIn(config.risk?.maxAbsFundingE9PerSlot, 0, 10_000, "risk.maxAbsFundingE9PerSlot");
}

export function toPercolatorInitMarket(config: PercolatorMarketGroupConfig) {
  validateMarketGroupConfig(config);
  return {
    max_portfolio_assets: config.portfolio.maxAssets,
    h_min: 0,
    h_max: 10,
    initial_price: config.price.initialE6,
    min_nonzero_mm_req: 1n,
    min_nonzero_im_req: 2n,
    maintenance_margin_bps: config.risk.maintenanceMarginBps,
    initial_margin_bps: config.risk.initialMarginBps,
    max_trading_fee_bps: config.risk.maxTradingFeeBps,
    trade_fee_base_bps: config.risk.tradeFeeBaseBps,
    liquidation_fee_bps: config.risk.liquidationFeeBps,
    liquidation_fee_cap: 0n,
    min_liquidation_abs: 0n,
    max_price_move_bps_per_slot: config.risk.maxPriceMoveBpsPerSlot,
    max_accrual_dt_slots: 1,
    max_abs_funding_e9_per_slot: config.risk.maxAbsFundingE9PerSlot,
    min_funding_lifetime_slots: 1,
    max_account_b_settlement_chunks: 1,
    max_bankrupt_close_chunks: 1,
    max_bankrupt_close_lifetime_slots: 100,
    public_b_chunk_atoms: 10_000_000_000_000_000n,
    maintenance_fee_per_slot: 0n,
  } as const;
}
