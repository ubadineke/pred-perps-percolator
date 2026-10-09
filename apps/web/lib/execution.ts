import "server-only";
import type { ExecutionConfig } from "./moxie-client";

/** Execution settings for the configured market group, read from server environment variables. */
export function getExecutionConfig(): ExecutionConfig {
  return {
    cluster: process.env.MOXIE_CLUSTER ?? "devnet",
    percolatorProgramId: process.env.PERCOLATOR_PROGRAM_ID ?? "",
    marketAccount: process.env.MOXIE_MARKET_ACCOUNT ?? "",
    usdcMint: process.env.MOXIE_USDC_MINT ?? "",
    collateralVault: process.env.MOXIE_COLLATERAL_VAULT ?? "",
    lpPortfolio: process.env.MOXIE_LP_PORTFOLIO ?? "",
    matcherProgramId: process.env.MOXIE_MATCHER_PROGRAM_ID ?? "",
    matcherContext: process.env.MOXIE_MATCHER_CONTEXT ?? "",
    matcherDelegate: process.env.MOXIE_MATCHER_DELEGATE ?? "",
    portfolioAccountSize: 9563,
    // The configured market group is fully collateralized (100% initial margin).
    maxLeverage: Number(process.env.MOXIE_MAX_LEVERAGE ?? 1) || 1,
  };
}
