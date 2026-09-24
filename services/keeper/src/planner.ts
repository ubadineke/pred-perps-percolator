export type Lifecycle = "active" | "restricted" | "reduce-only" | "locked" | "resolved";
export type PortfolioHealth = {
  address: string;
  maintenanceHealthy: boolean;
  positionCount: number;
};
export type MarketWork = {
  lifecycle: Lifecycle;
  oracleFresh: boolean;
  fundingPending: boolean;
  portfolios: readonly PortfolioHealth[];
};
export type KeeperAction =
  | { kind: "refresh-oracle" }
  | { kind: "crank-funding" }
  | { kind: "liquidate"; portfolio: string }
  | { kind: "hard-flat"; portfolio: string }
  | { kind: "await-resolution" };

/** Deterministic and restart-safe: inputs come from chain, no local cursor is authoritative. */
export function planKeeperWork(work: MarketWork): KeeperAction[] {
  if (work.lifecycle === "resolved") return [];
  const actions: KeeperAction[] = [];
  if (!work.oracleFresh && work.lifecycle !== "locked") actions.push({ kind: "refresh-oracle" });
  if (work.fundingPending && work.lifecycle !== "locked") actions.push({ kind: "crank-funding" });
  for (const portfolio of [...work.portfolios].sort((a, b) => a.address.localeCompare(b.address))) {
    if (!portfolio.maintenanceHealthy) actions.push({ kind: "liquidate", portfolio: portfolio.address });
    else if (work.lifecycle === "reduce-only" && portfolio.positionCount > 0) {
      actions.push({ kind: "hard-flat", portfolio: portfolio.address });
    }
  }
  if (work.lifecycle === "locked") actions.push({ kind: "await-resolution" });
  return actions;
}
