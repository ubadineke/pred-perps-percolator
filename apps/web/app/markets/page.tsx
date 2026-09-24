import { Search, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MarketTable } from "@/components/market-table";
import { getMarkets } from "@/lib/api";

export default async function MarketsPage() {
  const markets=await getMarkets();
  return (
    <AppShell>
      <div className="page-container markets-page">
        <div className="page-title"><div><p className="eyebrow">DISCOVER</p><h1>Markets</h1><p>Trade the movement in probability before the event becomes certainty.</p></div><div className="market-stats"><span><b>{markets.length}</b>INDEXED</span><span><b>{markets.filter(x=>x.status<4).length}</b>TRADABLE</span><span><b>LIVE</b>CHAIN DATA</span></div></div>
        <div className="market-toolbar">
          <label className="search-box"><Search size={17} /><input type="search" aria-label="Search markets" placeholder="Search markets" /></label>
          <div className="filter-tabs"><button className="selected" type="button">All</button><button type="button">Crypto</button><button type="button">Politics</button><button type="button">Economics</button></div>
          <button className="filter-button" type="button"><SlidersHorizontal size={16} /> Filters</button>
        </div>
        {markets.length?<MarketTable markets={markets}/>:<div className="empty-activity"><div><b>No active markets</b><span>The indexer is online, but no imported perps are currently available.</span></div></div>}
      </div>
    </AppShell>
  );
}
