import type { ApiPortfolio } from "@/lib/api";
import type { MoxieAccount, PortfolioState } from "@/hooks/use-moxie-account";
import type { Market } from "@/lib/markets";

// Sample account data for documentation screenshots only (rendered by /capture, never by real pages).

const SAMPLE_ADDRESS = "D3AsxZ1H6sYJ4JPcXdo1XJMed3zJydnZ6JMbj4hN3P2V";
const noop = async () => true;

function samplePortfolio(markets: Market[], funded: boolean): ApiPortfolio {
  const [first, second] = markets;
  const positions = funded
    ? [
        first && { slot: 0, assetIndex: first.assetIndex, marketId: first.marketId, side: "long" as const, sizeQ: "150000000", entryPriceE6: String(Math.round((first.mark - 1.2) * 10_000)), stale: false },
        second && { slot: 1, assetIndex: second.assetIndex, marketId: second.marketId, side: "short" as const, sizeQ: "-80000000", entryPriceE6: String(Math.round((second.mark + 0.8) * 10_000)), stale: false },
      ].filter((p): p is NonNullable<typeof p> => Boolean(p))
    : [];
  return {
    address: "Em17bXzKw2QNScV1HRSKEBLY3FnieXXkgcxzSJpEjAtj",
    owner: "",
    slot: 0,
    capital: funded ? "500000000" : "0",
    pnl: "0",
    portfolioId: "4",
    positionEpoch: "2",
    sequence: "3",
    health: {
      valid: true,
      equity: funded ? "500000000" : "0",
      initialRequirement: funded ? "126000000" : "0",
      maintenanceRequirement: funded ? "126000000" : "0",
      liquidationDeficit: "0",
      worstCaseLoss: "0",
    },
    positions,
  };
}

export function sampleAccount(stage: "disconnected" | "create" | "fund" | "trading", markets: Market[]): MoxieAccount {
  const state: PortfolioState = stage === "disconnected" ? "disconnected" : stage === "create" ? "none" : "ready";
  const portfolio = stage === "fund" ? samplePortfolio(markets, false) : stage === "trading" ? samplePortfolio(markets, true) : null;
  return {
    address: stage === "disconnected" ? "" : SAMPLE_ADDRESS,
    configured: true,
    portfolio,
    state,
    walletUsdc: stage === "trading" ? 9_500 : 1_000,
    walletSol: stage === "create" ? 0.02 : 1.5,
    busy: null,
    notice: null,
    dismissNotice: () => undefined,
    refresh: async () => undefined,
    createPortfolio: noop,
    requestTestUsdc: noop,
    requestTestSol: noop,
    deposit: noop,
    withdraw: noop,
    trade: noop,
    close: noop,
  };
}
