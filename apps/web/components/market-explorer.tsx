"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Market, MarketProvider } from "@/lib/markets";
import { MarketTable } from "./market-table";
import { EmptyState, Segmented } from "./ui/primitives";

type ProviderFilter = "all" | MarketProvider;

export function MarketExplorer({ markets }: { markets: Market[] }) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<ProviderFilter>("all");

  // Only offer source filters for sources that actually have markets.
  const providers = useMemo(() => {
    const seen = new Map<MarketProvider, string>();
    for (const market of markets) seen.set(market.provider, market.providerLabel);
    return [...seen.entries()];
  }, [markets]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return markets.filter(
      (market) =>
        (source === "all" || market.provider === source) &&
        (!needle || market.question.toLowerCase().includes(needle) || market.providerMarketId.toLowerCase().includes(needle)),
    );
  }, [markets, query, source]);

  return (
    <section aria-labelledby="markets-heading" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="markets-heading" className="text-xl font-semibold tracking-tight">
          Tradable markets <span className="ml-1 font-mono text-base font-normal text-subtle">{markets.length}</span>
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {providers.length > 1 ? (
            <Segmented
              label="Filter by source"
              value={source}
              onChange={setSource}
              options={[{ value: "all", label: "All" }, ...providers.map(([value, label]) => ({ value, label }))]}
            />
          ) : null}
          <label className="flex h-10 items-center gap-2 rounded-md border border-border-strong bg-surface px-3 focus-within:border-signal sm:w-72">
            <Search className="size-4 shrink-0 text-subtle" aria-hidden="true" />
            <span className="sr-only">Search markets</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search markets"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-subtle focus-visible:outline-none"
            />
          </label>
        </div>
      </div>
      {visible.length ? (
        <MarketTable markets={visible} />
      ) : (
        <div className="rounded-lg border border-border">
          <EmptyState icon={<Search />} title="No markets match your search" description="Try a different word, or clear the filter." />
        </div>
      )}
    </section>
  );
}
