import { ArrowUpRight, Database, ShieldCheck } from "lucide-react";
import type { ApiPantaMarket, ApiProviderStatus } from "@/lib/api";

const probability=(value?:number)=>value===undefined?"—":`${(value/10_000).toFixed(1)}%`;
const volume=(value?:string)=>{if(!value)return"—";const amount=Number(value)/1_000_000;if(!Number.isFinite(amount))return"—";return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:1}).format(amount)};
const closes=(value:number)=>{const remaining=value-Date.now();if(remaining<=0)return"Locked";const days=Math.floor(remaining/86_400_000);const hours=Math.floor(remaining%86_400_000/3_600_000);return days?`${days}d ${hours}h`:`${hours}h`};

export function PantaMarketGrid({markets,status}:{markets:ApiPantaMarket[];status?:ApiProviderStatus}){
  return <section className="panta-catalog" aria-labelledby="panta-catalog-title">
    <header className="provider-heading">
      <div><span className="provider-label"><Database size={13}/> PANTA UNDERLYINGS</span><h2 id="panta-catalog-title">Underlying market feed</h2><p>Probability references from Panta. Moxie execution and margin remain on Solana devnet.</p></div>
      <div className="provider-state"><i className={status?.stale?"stale":""}/><span>{status?.stale?"SOURCE STALE":"SOURCE LIVE"}</span><em>MAINNET DATA</em></div>
    </header>
    {markets.length?<div className="panta-grid">{markets.map(market=>{const candidate=market.status==="open"&&market.closeTime>Date.now()&&market.indexPriceE6!==undefined;return <article className="panta-card" key={market.providerMarketId}>
      <div className="panta-card-top"><span>{market.category||market.providerPhase||"EVENT"}</span><em>{market.status.toUpperCase()}</em></div>
      <h3>{market.title}</h3>
      <div className="panta-probability"><span><em>YES INDEX</em><strong>{probability(market.indexPriceE6)}</strong></span><i/><span><em>NO INDEX</em><strong>{market.indexPriceE6===undefined?"—":probability(1_000_000-market.indexPriceE6)}</strong></span></div>
      <dl><div><dt>Volume</dt><dd>{volume(market.volumeUsdE6)}</dd></div><div><dt>Closes in</dt><dd>{closes(market.closeTime)}</dd></div></dl>
      <footer><span><ShieldCheck size={13}/>{candidate?"Perp candidate":"Reference only"}</span>{market.sourceUrl?<a href={market.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open ${market.title} on Panta`}>View source <ArrowUpRight size={14}/></a>:null}</footer>
    </article>})}</div>:<div className="empty-activity"><div><b>No Panta markets returned</b><span>The provider is connected, but its catalog is currently empty.</span></div></div>}
    <p className="provider-disclaimer">Panta prices are reference observations, not executable Moxie quotes. A market becomes tradable only after Moxie admission, oracle configuration, and local liquidity activation.</p>
  </section>
}
