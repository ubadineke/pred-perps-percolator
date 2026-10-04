import { AppShell } from "@/components/app-shell";
import { MarketExplorer } from "@/components/market-explorer";
import { PantaMarketGrid } from "@/components/panta-market-grid";
import { getMarkets, getPantaMarkets, getPantaStatus } from "@/lib/api";

export default async function MarketsPage() {
  const [marketsResult,pantaResult,pantaStatusResult]=await Promise.allSettled([getMarkets(),getPantaMarkets(),getPantaStatus()]);
  const markets=marketsResult.status==="fulfilled"?marketsResult.value:[];
  const pantaMarkets=pantaResult.status==="fulfilled"?pantaResult.value:[];
  const pantaStatus=pantaStatusResult.status==="fulfilled"?pantaStatusResult.value:undefined;
  return (
    <AppShell>
      <div className="page-container markets-page">
        <div className="page-title"><div><p className="eyebrow">DISCOVER</p><h1>Markets</h1><p>Trade the movement in probability before the event becomes certainty.</p></div><div className="market-stats"><span><b>{markets.length}</b>INDEXED</span><span><b>{markets.filter(x=>x.status<4).length}</b>TRADABLE</span><span><b>LIVE</b>CHAIN DATA</span></div></div>
        {markets.length?<MarketExplorer markets={markets}/>:<div className="empty-activity"><div><b>No active markets</b><span>The indexer is online, but no imported perps are currently available.</span></div></div>}
        {pantaResult.status==="rejected"?<section className="panta-catalog"><header className="provider-heading"><div><span className="provider-label">PANTA UNDERLYINGS</span><h2>Provider catalog unavailable</h2><p>Moxie markets remain available. Check the server-side Panta configuration to restore discovery.</p></div></header></section>:<PantaMarketGrid markets={pantaMarkets} status={pantaStatus}/>}
      </div>
    </AppShell>
  );
}
