"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { getMarketTrades, type ApiTrade } from "@/lib/api";
import { cents, contracts, e6ToCents, qToContracts, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState, Skeleton } from "../ui/primitives";

/** Latest fills in one market, newest first. */
export function RecentFills({ marketAddress, cluster, ownPortfolio }: { marketAddress: string; cluster: string; ownPortfolio?: string }) {
  const [fills, setFills] = useState<ApiTrade[] | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => getMarketTrades(marketAddress).then((next) => active && setFills(next)).catch(() => active && setFills((current) => current ?? []));
    void load();
    const timer = setInterval(load, 5_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [marketAddress]);

  if (fills === null) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
    );
  }
  if (!fills.length) return <EmptyState title="No fills yet" description="Trades in this market appear here." />;

  return (
    <ul className="divide-y divide-border">
      {fills.slice(0, 20).map((fill) => {
        const size = qToContracts(fill.data.executedSizeQ ?? fill.data.sizeQ ?? "0");
        const long = size >= 0;
        const price = fill.data.executionPriceE6 ?? fill.data.limitPriceE6;
        const own = ownPortfolio && fill.portfolio === ownPortfolio;
        return (
          <li key={`${fill.signature}:${fill.instructionIndex}`}>
            <a
              href={`https://explorer.solana.com/tx/${fill.signature}?cluster=${cluster}`}
              target="_blank"
              rel="noreferrer"
              className="grid grid-cols-[4.5rem_1fr_1fr_auto] items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-2"
            >
              <span className={cn("font-medium", long ? "text-long" : "text-short")}>{long ? "Long" : "Short"}</span>
              <span className="font-mono text-foreground">{contracts(size)} <span className="font-sans text-xs text-subtle">contracts</span></span>
              <span className="font-mono text-muted">{price ? cents(e6ToCents(price)) : "—"}</span>
              <span className="flex items-center gap-2 text-xs text-subtle">
                {own ? <span className="rounded-sm bg-signal/10 px-1.5 py-0.5 font-medium text-signal">You</span> : null}
                {fill.blockTime ? timeAgo(fill.blockTime) : null}
                <ExternalLink className="size-3" aria-hidden="true" />
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
