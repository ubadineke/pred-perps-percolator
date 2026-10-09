"use client";

import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { MoxieAccount } from "@/hooks/use-moxie-account";
import type { Market } from "@/lib/markets";
import { isTradable } from "@/lib/markets";
import { MatcherCapacityError, freeCollateralUsd, planOrder, quoteMatcher, SLIPPAGE_E6, type ExecutionConfig, type Side } from "@/lib/moxie-client";
import { cents, contracts, usd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AccountGate, TxNoticeView } from "../account/account-gate";
import { CollateralPanel } from "../account/collateral-panel";
import { AmountField } from "../ui/amount-field";
import { Button } from "../ui/button";
import { Segmented, SummaryRow } from "../ui/primitives";

export function OrderTicket({ market, account, config, matcherData }: { market: Market; account: MoxieAccount; config: ExecutionConfig; matcherData: Uint8Array | null }) {
  const [side, setSide] = useState<Side>("long");
  const [amount, setAmount] = useState("");
  const [leverage, setLeverage] = useState(1);
  const portfolio = account.portfolio;
  const free = portfolio ? freeCollateralUsd(portfolio) : 0;
  const value = Number(amount);
  const plan = useMemo(() => planOrder(side, value, market.mark, leverage), [side, value, market.mark, leverage]);

  // Preview the fill the matcher would give this exact size.
  const quote = useMemo(() => {
    if (!plan || !matcherData) return { price: null as number | null, error: null as string | null };
    try {
      const quoteE6 = quoteMatcher(matcherData, BigInt(Math.round(market.mark * 10_000)), plan.sizeQ);
      return { price: Number(quoteE6) / 10_000, error: null };
    } catch (cause) {
      return { price: null, error: cause instanceof MatcherCapacityError ? cause.message : "The liquidity provider is unavailable." };
    }
  }, [plan, matcherData, market.mark]);

  const tradable = isTradable(market);
  const overFree = value > free + 1e-9;
  const funded = portfolio ? Number(portfolio.capital) > 0 : false;
  const canSubmit = Boolean(portfolio && tradable && plan && !overFree && !quote.error && account.busy === null);
  const leverageOptions = Array.from({ length: Math.max(1, config.maxLeverage) }, (_, i) => i + 1);

  async function submit() {
    if (!plan) return;
    const ok = await account.trade(market, plan.sizeQ);
    if (ok) setAmount("");
  }

  return (
    <div className="flex flex-col gap-5">
      <Segmented
        label="Order side"
        value={side}
        onChange={setSide}
        className="w-full"
        options={[
          { value: "long", label: <span>Long <span className="font-normal opacity-70">· Yes</span></span>, tone: "long" },
          { value: "short", label: <span>Short <span className="font-normal opacity-70">· No</span></span>, tone: "short" },
        ]}
      />

      {portfolio ? null : <AccountGate account={account} />}

      {portfolio && !funded ? (
        <div className="space-y-3 rounded-lg border border-dashed border-border-strong p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Fund your portfolio</p>
            <p className="mt-1 text-sm text-muted">Deposit USDC to start trading. Collateral is shared across every market.</p>
          </div>
          <CollateralPanel account={account} cluster={config.cluster} compact />
        </div>
      ) : null}

      {portfolio && funded ? (
        <>
          <AmountField
            label="Amount"
            labelAside={`Free ${usd(free)}`}
            value={amount}
            onChange={setAmount}
            unit="USDC"
            max={free}
            disabled={!tradable}
            presets={[
              { label: "25%", value: (free * 0.25).toFixed(2) },
              { label: "50%", value: (free * 0.5).toFixed(2) },
              { label: "75%", value: (free * 0.75).toFixed(2) },
              { label: "Max", value: Math.max(free - 0.005, 0).toFixed(2) },
            ]}
            error={overFree ? "More than your free collateral. Deposit more or lower the amount." : quote.error ?? undefined}
          />

          {leverageOptions.length > 1 ? (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted">Leverage</p>
              <Segmented
                label="Leverage"
                value={String(leverage)}
                onChange={(next) => setLeverage(Number(next))}
                className="w-full"
                options={leverageOptions.map((n) => ({ value: String(n), label: `${n}×` }))}
              />
            </div>
          ) : null}

          <dl className="space-y-2.5 border-y border-border py-4">
            <SummaryRow label="Contracts" value={plan ? contracts(plan.contracts) : "—"} />
            <SummaryRow label="Est. fill price" value={quote.price !== null ? cents(quote.price) : cents(market.mark)} />
            <SummaryRow label="Margin used" value={plan ? usd(plan.marginUsd) : "—"} tone="muted" />
            <SummaryRow label="Fee (0.3%)" value={plan ? usd(plan.feeUsd) : "—"} tone="muted" />
            <SummaryRow
              label={side === "long" ? "Pays if Yes" : "Pays if No"}
              value={plan ? usd(plan.maxPayoutUsd) : "—"}
              tone={side === "long" ? "long" : "short"}
            />
          </dl>

          <Button variant={side} size="lg" className="w-full" disabled={!canSubmit} loading={account.busy === "trade"} onClick={submit}>
            {!tradable ? `Market ${market.lifecycle.toLowerCase()}` : side === "long" ? "Buy Yes · Long" : "Buy No · Short"}
          </Button>

          <p className="flex items-start gap-2 text-xs text-subtle">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-long" aria-hidden="true" />
            <span>Price-protected: the order fails rather than filling more than {(Number(SLIPPAGE_E6) / 10_000).toFixed(0)}¢ worse than the quote.</span>
          </p>
        </>
      ) : null}

      <TxNoticeView notice={account.notice} cluster={config.cluster} onDismiss={account.dismissNotice} />

      {portfolio && funded ? (
        <details className={cn("group rounded-lg border border-border")}>
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-foreground marker:hidden">
            Collateral
            <span className="font-mono text-xs text-subtle">{usd(free)} free</span>
          </summary>
          <div className="border-t border-border p-4">
            <CollateralPanel account={account} cluster={config.cluster} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
