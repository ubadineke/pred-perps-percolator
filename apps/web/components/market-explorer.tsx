"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Market, MarketProvider } from "@/lib/markets";
import { MarketTable } from "./market-table";

type ProviderFilter = "all" | MarketProvider;

const filters: ReadonlyArray<{ value: ProviderFilter; label: string }> = [
  { value: "all", label: "All sources" },
  { value: "panta", label: "Panta" },
  { value: "jupiter", label: "Jupiter" },
];

export function MarketExplorer({ markets }: { markets: Market[] }) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<ProviderFilter>("all");
  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return markets.filter(
      (market) =>
        (source === "all" || market.provider === source) &&
        (!normalized ||
          market.question.toLowerCase().includes(normalized) ||
          market.providerMarketId.toLowerCase().includes(normalized)),
    );
  }, [markets, query, source]);

  return (
    <section aria-labelledby="moxie-markets-title">
      <div className="market-section-heading">
        <div>
          <span className="provider-label">MOXIE PERPETUALS</span>
          <h2 id="moxie-markets-title">Activated markets</h2>
          <p>Executable perps on Moxie, sourced from an external prediction market.</p>
        </div>
        <div className="market-legend" aria-label="Market label guide">
          <span><i className="legend-source" />SOURCE</span>
          <span><i className="legend-state" />MOXIE STATE</span>
        </div>
      </div>
      <div className="market-toolbar">
        <label className="search-box">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search activated markets</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search activated markets"
          />
        </label>
        <div className="filter-tabs" aria-label="Filter by underlying provider">
          {filters.map((filter) => (
            <button
              key={filter.value}
              className={source === filter.value ? "selected" : ""}
              type="button"
              aria-pressed={source === filter.value}
              onClick={() => setSource(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
      {visible.length ? (
        <MarketTable markets={visible} />
      ) : (
        <div className="empty-activity">
          <div>
            <b>No matching activated markets</b>
            <span>Try another search or select a different provider.</span>
          </div>
        </div>
      )}
    </section>
  );
}
