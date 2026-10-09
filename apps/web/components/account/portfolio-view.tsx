"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { useMoxieAccount } from "@/hooks/use-moxie-account";
import { getMarkets } from "@/lib/api";
import type { Market } from "@/lib/markets";
import { freeCollateralUsd, positionPnlUsd, type ExecutionConfig } from "@/lib/moxie-client";
import { atomsToUsd, shortAddress, usd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AccountGate, TxNoticeView } from "./account-gate";
import { CollateralPanel } from "./collateral-panel";
import { PositionsTable } from "./positions-table";
import { Panel, PanelHeader, Stat } from "../ui/primitives";

export function PortfolioView({ config, markets: initialMarkets }: { config: ExecutionConfig; markets: Market[] }) {
  const account = useMoxieAccount(config);
  const [markets, setMarkets] = useState(initialMarkets);

  useEffect(() => {
    const timer = setInterval(() => void getMarkets().then(setMarkets).catch(() => undefined), 10_000);
    return () => clearInterval(timer);
  }, []);

  const portfolio = account.portfolio;
  if (!portfolio) {
    return (
      <div className="max-w-xl">
        <AccountGate account={account} />
        <div className="mt-4">
          <TxNoticeView notice={account.notice} cluster={config.cluster} onDismiss={account.dismissNotice} />
        </div>
      </div>
    );
  }

  const deposited = atomsToUsd(portfolio.capital);
  const free = freeCollateralUsd(portfolio);
  const margin = atomsToUsd(portfolio.health.initialRequirement);
  const pnl = portfolio.positions.reduce((sum, position) => {
    const market = markets.find((m) => m.marketId === position.marketId && m.assetIndex === position.assetIndex);
    return market ? sum + positionPnlUsd(position, market.mark) : sum;
  }, 0);
  const equity = deposited + pnl;
  const deficit = atomsToUsd(portfolio.health.liquidationDeficit);
  const healthy = portfolio.health.valid ? deficit === 0 : true;
  const utilization = equity > 0 ? Math.min((margin / equity) * 100, 100) : 0;

  return (
    <div className="space-y-6">
      <TxNoticeView notice={account.notice} cluster={config.cluster} onDismiss={account.dismissNotice} />

      <Panel className="p-5 sm:p-6">
        <dl className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          <Stat size="lg" label="Equity" value={usd(equity)} hint={`Portfolio ${shortAddress(portfolio.address)}`} />
          <Stat size="lg" label="Free collateral" value={usd(free)} hint="Available to trade or withdraw" />
          <Stat size="lg" label="Margin in use" value={usd(margin)} hint={`${utilization.toFixed(0)}% of equity`} />
          <Stat size="lg" label="Est. unrealized PnL" value={`${pnl >= 0 ? "+" : ""}${usd(pnl)}`} tone={pnl > 0 ? "long" : pnl < 0 ? "short" : undefined} hint={`${portfolio.positions.length} open position${portfolio.positions.length === 1 ? "" : "s"}`} />
        </dl>
        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-surface-3" role="meter" aria-label="Margin utilization" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(utilization)}>
          <div className={cn("h-full rounded-full", utilization > 85 ? "bg-short" : utilization > 60 ? "bg-warning" : "bg-signal")} style={{ width: `${utilization}%` }} />
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel>
          <PanelHeader title="Open positions" description="One collateral account backs every position." />
          <PositionsTable account={account} markets={markets} emptyHint="Pick a market to open your first position." />
        </Panel>

        <div className="space-y-6">
          <Panel>
            <PanelHeader title="Collateral" />
            <div className="p-5">
              <CollateralPanel account={account} cluster={config.cluster} />
            </div>
          </Panel>
          <Panel className="p-5">
            <div className="flex items-center gap-3">
              {healthy ? <ShieldCheck className="size-5 text-long" aria-hidden="true" /> : <ShieldAlert className="size-5 text-short" aria-hidden="true" />}
              <div>
                <p className="text-sm font-medium">{healthy ? "Healthy" : "At risk of liquidation"}</p>
                <p className="text-xs text-subtle">{healthy ? "Collateral covers every open position." : `Short by ${usd(deficit)} — deposit or reduce positions.`}</p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
