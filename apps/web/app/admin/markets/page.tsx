import { AppShell } from "@/components/app-shell";
import { AdminMarketConsole } from "@/components/admin-market-console";
import { getMarkets, getPantaMarkets } from "@/lib/api";

export default async function AdminMarketsPage(){
  const [providerResult,activeResult]=await Promise.allSettled([getPantaMarkets(50),getMarkets()]);
  const markets=providerResult.status==="fulfilled"?providerResult.value:[];
  const active=activeResult.status==="fulfilled"?activeResult.value:[];
  const nextMarketId=active.reduce((max,market)=>Math.max(max,Number(market.marketId)),0)+1;
  const nextAssetIndex=active.reduce((max,market)=>Math.max(max,market.assetIndex),-1)+1;
  const config={adminAddress:process.env.MOXIE_MARKET_AUTHORITY??"",marketAccount:process.env.MOXIE_MARKET_ACCOUNT??"",oracleProgramId:process.env.MOXIE_ORACLE_PROGRAM_ID??"",percolatorProgramId:process.env.PERCOLATOR_PROGRAM_ID??"",nextAssetIndex,nextMarketId:String(nextMarketId),cluster:process.env.MOXIE_CLUSTER??"devnet"};
  return <AppShell><div className="admin-page"><div className="admin-title"><div><p className="eyebrow">CONTROL PLANE / MARKET AUTHORITY</p><h1>Market admission</h1><p>Curate external events into leveraged Moxie markets. Every activation is authority-signed and enforced on-chain.</p></div><div className="admin-mode"><i/><span>ADMIN-GATED</span><em>{config.cluster.toUpperCase()}</em></div></div>{providerResult.status==="rejected"?<div className="admin-notice error"><span><b>Provider catalog unavailable</b>Restart the indexer or verify the server-side Panta key.</span></div>:<AdminMarketConsole markets={markets} config={config}/>}</div></AppShell>;
}
