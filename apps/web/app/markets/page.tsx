import { Search, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MarketTable } from "@/components/market-table";

export default function MarketsPage() {
  return (
    <AppShell>
      <div className="page-container markets-page">
        <div className="page-title"><div><p className="eyebrow">DISCOVER</p><h1>Markets</h1><p>Trade the movement in probability before the event becomes certainty.</p></div><div className="market-stats"><span><b>4</b>ACTIVE</span><span><b>$6.57M</b>24H VOLUME</span><span><b>$2.26M</b>OPEN INTEREST</span></div></div>
        <div className="market-toolbar">
          <label className="search-box"><Search size={17} /><input type="search" aria-label="Search markets" placeholder="Search markets" /></label>
          <div className="filter-tabs"><button className="selected" type="button">All</button><button type="button">Crypto</button><button type="button">Politics</button><button type="button">Economics</button></div>
          <button className="filter-button" type="button"><SlidersHorizontal size={16} /> Filters</button>
        </div>
        <MarketTable />
      </div>
    </AppShell>
  );
}
