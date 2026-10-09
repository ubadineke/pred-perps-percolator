"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useMoxieAccount } from "@/hooks/use-moxie-account";
import { useMatcherData } from "@/hooks/use-matcher";
import { getMarket, getMarkets } from "@/lib/api";
import type { Market } from "@/lib/markets";
import type { ExecutionConfig } from "@/lib/moxie-client";
import { cents, centsChange, countdown, usdShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PositionsTable } from "../account/positions-table";
import { Badge, MarketAvatar } from "../ui/primitives";
import { OrderTicket } from "./order-ticket";
import { PriceChart } from "./price-chart";
import { RecentFills } from "./recent-fills";

const REFRESH_MS = 5_000;

export function TradeTerminal({ market: initialMarket, markets: initialMarkets, config }: { market: Market; markets: Market[]; config: ExecutionConfig }) {
  const [market, setMarket] = useState(initialMarket);
  const [markets, setMarkets] = useState(initialMarkets);
  const [tab, setTab] = useState<"positions" | "fills">("positions");
  const account = useMoxieAccount(config);
  const matcherData = useMatcherData(config.matcherContext);

  // Keep prices and stats live without a page reload.
  useEffect(() => {
    let active = true;
    const load = async () => {
      const [next, list] = await Promise.allSettled([getMarket(initialMarket.address), getMarkets()]);
      if (!active) return;
      if (next.status === "fulfilled") setMarket(next.value);
      if (list.status === "fulfilled") setMarkets(list.value);
    };
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [initialMarket.address]);

  const positionCount = account.portfolio?.positions.length ?? 0;

  return (
    <div className="lg:grid lg:h-[calc(100dvh-4rem)] lg:grid-cols-[17rem_minmax(0,1fr)_22rem] lg:overflow-hidden">
      <MarketRail markets={markets} activeSlug={market.slug} />

      <div className="flex min-w-0 flex-col lg:min-h-0 lg:border-r lg:border-border">
        <MarketHeader market={market} markets={markets} />
        <div className="h-80 border-b border-border sm:h-96 lg:h-auto lg:min-h-0 lg:flex-1">
          <PriceChart marketAddress={market.address} ownPortfolio={account.portfolio?.address} />
        </div>
        <section aria-label="Account activity" className="lg:h-64 lg:min-h-0 lg:overflow-y-auto">
          <div role="tablist" aria-label="Account activity" className="sticky top-0 z-10 flex gap-1 border-b border-border bg-background px-3">
            <TabButton active={tab === "positions"} onClick={() => setTab("positions")}>
              Positions {positionCount ? <span className="ml-1.5 rounded-sm bg-surface-3 px-1.5 font-mono text-xs">{positionCount}</span> : null}
            </TabButton>
            <TabButton active={tab === "fills"} onClick={() => setTab("fills")}>Market fills</TabButton>
          </div>
          <div role="tabpanel">
            {tab === "positions" ? (
              <PositionsTable account={account} markets={markets} emptyHint={account.portfolio ? "Open a position with the order ticket." : "Connect and fund a portfolio to trade."} />
            ) : (
              <RecentFills marketAddress={market.address} cluster={config.cluster} ownPortfolio={account.portfolio?.address} />
            )}
          </div>
        </section>
      </div>

      <aside aria-label="Order ticket" className="border-t border-border p-4 sm:p-5 lg:overflow-y-auto lg:border-t-0">
        <OrderTicket market={market} account={account} config={config} matcherData={matcherData} />
      </aside>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative flex h-11 items-center px-3 text-sm font-medium transition-colors",
        active ? "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-signal" : "text-subtle hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function MarketRail({ markets, activeSlug }: { markets: Market[]; activeSlug: string }) {
  return (
    <nav aria-label="Markets" className="hidden min-h-0 overflow-y-auto border-r border-border lg:block">
      <p className="px-4 pb-2 pt-4 text-xs font-medium text-subtle">Markets</p>
      <ul>
        {markets.map((item) => {
          const active = item.slug === activeSlug;
          const change = item.stats.change24hCents;
          return (
            <li key={item.slug}>
              <Link
                href={`/trade/${item.slug}`}
                aria-current={active ? "page" : undefined}
                className={cn("flex gap-3 border-l-2 px-4 py-3 transition-colors", active ? "border-signal bg-surface" : "border-transparent hover:bg-surface")}
              >
                <MarketAvatar initials={item.initials} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className={cn("line-clamp-2 text-sm leading-snug", active ? "text-foreground" : "text-muted")}>{item.question}</span>
                  <span className="mt-1 flex items-baseline gap-2 font-mono text-xs">
                    <span className="text-foreground">{cents(item.mark)}</span>
                    <span className={change === null || change === 0 ? "text-subtle" : change > 0 ? "text-long" : "text-short"}>{centsChange(change)}</span>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function MarketHeader({ market, markets }: { market: Market; markets: Market[] }) {
  const router = useRouter();
  const change = market.stats.change24hCents;
  return (
    <div className="border-b border-border px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        <MarketAvatar initials={market.initials} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold leading-snug tracking-tight text-foreground">{market.question}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge>{market.providerLabel}</Badge>
            <Badge tone={market.status === 1 ? "long" : "warning"}>{market.lifecycle}</Badge>
          </div>
        </div>
        {/* Mobile market switcher (the rail is desktop-only). */}
        {markets.length > 1 ? (
          <label className="relative lg:hidden">
            <span className="sr-only">Switch market</span>
            <select
              value={market.slug}
              onChange={(event) => router.push(`/trade/${event.target.value}`)}
              className="h-9 max-w-[7.5rem] appearance-none rounded-md border border-border-strong bg-surface pl-3 pr-7 text-xs text-foreground"
            >
              {markets.map((item) => (
                <option key={item.slug} value={item.slug}>{item.question}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-subtle" aria-hidden="true" />
          </label>
        ) : null}
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-6">
        <HeaderStat label="Price" value={<span className="text-foreground">{cents(market.mark)}</span>} />
        <HeaderStat label="24h" value={<span className={change === null || change === 0 ? "text-subtle" : change > 0 ? "text-long" : "text-short"}>{centsChange(change)}</span>} />
        <HeaderStat
          label="Source index"
          value={
            <span className="text-muted">
              {cents(market.index)}
              {market.indexStale ? <span className="ml-1 font-sans text-xs text-warning">paused</span> : null}
            </span>
          }
        />
        <HeaderStat label="24h volume" value={<span className="text-muted">{usdShort(market.stats.volume24hUsd)}</span>} />
        <HeaderStat label="Open interest" value={<span className="text-muted">{usdShort(market.stats.openInterestUsd)}</span>} />
        <HeaderStat label="Closes in" value={<span className="text-warning">{countdown(market.closeTime)}</span>} />
      </dl>
    </div>
  );
}

function HeaderStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="mt-0.5 truncate font-mono text-sm">{value}</dd>
    </div>
  );
}
