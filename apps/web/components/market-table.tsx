import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { markets } from "@/lib/markets";

export function MarketTable() {
  return (
    <div className="market-table-wrap">
      <table className="market-table">
        <thead><tr><th>Market</th><th>Moxie</th><th>Index</th><th>24h</th><th>Volume</th><th>Open interest</th><th>Locks in</th><th /></tr></thead>
        <tbody>{markets.map((market) => (
          <tr key={market.slug}>
            <td><Link href={`/trade/${market.slug}`}><i className={`market-symbol symbol-${market.category.toLowerCase()}`}>{market.short.slice(0, 2)}</i><span><b>{market.question}</b><em>{market.category} · {market.provider}</em></span></Link></td>
            <td><strong>{market.moxie.toFixed(1)}¢</strong></td>
            <td>{market.index.toFixed(1)}¢</td>
            <td className={market.change >= 0 ? "positive" : "negative"}>{market.change >= 0 ? "+" : ""}{market.change}%</td>
            <td>{market.volume}</td><td>{market.oi}</td><td>{market.lock}</td>
            <td><Link className="row-action" aria-label={`Trade ${market.question}`} href={`/trade/${market.slug}`}><ArrowUpRight size={17} /></Link></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
