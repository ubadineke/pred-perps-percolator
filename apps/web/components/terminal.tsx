"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, Clock3, ExternalLink, Info, Settings2, ShieldCheck } from "lucide-react";
import type { Market } from "@/lib/markets";
import { markets } from "@/lib/markets";

const chartPaths = {
  market: "M0 215 C35 200 48 226 78 190 S130 178 160 191 S210 180 236 150 S278 171 302 126 S350 140 378 104 S422 118 450 72 S500 80 540 43 S600 65 650 24",
  index: "M0 225 C60 212 92 203 130 205 S208 174 252 166 S338 134 390 126 S470 92 520 78 S590 55 650 49",
};

export function Terminal({ market }: { market: Market }) {
  const [side, setSide] = useState<"long" | "short">("long");
  const [collateral, setCollateral] = useState(500);
  const [leverage, setLeverage] = useState(3);
  const [notice, setNotice] = useState("");
  const position = collateral * leverage;
  const entry = useMemo(() => market.moxie + (side === "long" ? 0.35 : -0.35), [market.moxie, side]);
  const liquidation = side === "long" ? Math.max(0, entry - 100 / leverage + 2.7) : Math.min(100, entry + 100 / leverage - 2.7);

  return (
    <div className="terminal-layout">
      <aside className="market-rail">
        <div className="rail-search">MARKETS <span>⌘ K</span></div>
        {markets.map((item) => <Link href={`/trade/${item.slug}`} className={item.slug === market.slug ? "active" : ""} key={item.slug}><span><i />{item.short}</span><b>{item.moxie.toFixed(1)}¢</b><em className={item.change >= 0 ? "positive" : "negative"}>{item.change >= 0 ? "+" : ""}{item.change}%</em></Link>)}
      </aside>

      <section className="trade-workspace">
        <div className="trade-titlebar">
          <div><span className="market-icon">{market.short.slice(0, 2)}</span><div><p>{market.category} · {market.provider} <ExternalLink size={11} /></p><h1>{market.question}</h1></div></div>
          <dl><div><dt>MOXIE</dt><dd>{market.moxie.toFixed(1)}¢</dd></div><div><dt>INDEX</dt><dd>{market.index.toFixed(1)}¢</dd></div><div><dt>MARK</dt><dd>{market.mark.toFixed(1)}¢</dd></div><div><dt>24H</dt><dd className={market.change >= 0 ? "positive" : "negative"}>{market.change >= 0 ? "+" : ""}{market.change}%</dd></div><div><dt>LOCKS IN</dt><dd className="warning"><Clock3 size={12} /> {market.lock}</dd></div></dl>
        </div>
        <div className="chart-panel">
          <div className="chart-toolbar"><div><button className="active" type="button">Price</button><button type="button">Depth</button><button type="button">Premium</button></div><div><button className="active" type="button">1H</button><button type="button">4H</button><button type="button">1D</button><button type="button">1W</button><button aria-label="Chart settings" type="button"><Settings2 size={15} /></button></div></div>
          <div className="chart-area">
            <div className="chart-price"><strong>{market.moxie.toFixed(1)}¢</strong><span className="positive">+4.8¢ today</span></div>
            <svg viewBox="0 0 650 250" preserveAspectRatio="none" role="img" aria-label={`${market.short} price chart`}><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c7ff4a" stopOpacity=".22"/><stop offset="1" stopColor="#c7ff4a" stopOpacity="0"/></linearGradient></defs><path className="area-path" d={`${chartPaths.market} L650 250 L0 250 Z`} /><path className="index-path" d={chartPaths.index} /><path className="market-path" d={chartPaths.market} /><circle cx="650" cy="24" r="4" /></svg>
            <div className="y-axis"><span>75¢</span><span>65¢</span><span>55¢</span><span>45¢</span><span>35¢</span></div>
            <div className="x-axis"><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span><span>NOW</span></div>
          </div>
          <div className="chart-footer"><span><i className="moxie-dot" /> MOXIE {market.moxie.toFixed(1)}</span><span><i className="index-dot" /> INDEX {market.index.toFixed(1)}</span><span><i className="mark-dot" /> MARK {market.mark.toFixed(1)}</span><em>ORACLE 380ms AGO</em></div>
        </div>
        <div className="lower-panel">
          <div className="panel-tabs"><button className="active" type="button">Positions <span>1</span></button><button type="button">Open orders</button><button type="button">Trade history</button><button type="button">Funding / premium</button></div>
          <div className="position-row"><span><i className="position-side">L</i><b>{market.short}</b><em>3× LONG</em></span><span><small>SIZE</small><b>$1,500.00</b></span><span><small>ENTRY / MARK</small><b>58.6¢ / {market.mark.toFixed(1)}¢</b></span><span><small>PNL</small><b className="positive">+$94.67</b></span><span><small>LIQ. PRICE</small><b>27.9¢</b></span><button type="button">Close</button></div>
        </div>
      </section>

      <aside className="order-ticket">
        <div className="side-tabs"><button className={side === "long" ? "long active" : "long"} onClick={() => setSide("long")} type="button">LONG</button><button className={side === "short" ? "short active" : "short"} onClick={() => setSide("short")} type="button">SHORT</button></div>
        <div className="order-types"><button className="active" type="button">Market</button><button type="button">Limit</button><button type="button">Trigger</button></div>
        <div className="balance-line"><span>Available</span><b>$2,840.40 USDC</b></div>
        <label className="ticket-label" htmlFor="collateral">COLLATERAL</label>
        <div className="amount-field"><input id="collateral" type="number" min="10" value={collateral} onChange={(event) => setCollateral(Math.max(0, Number(event.target.value)))} /><b>USDC</b></div>
        <div className="quick-percent"><button onClick={() => setCollateral(710)} type="button">25%</button><button onClick={() => setCollateral(1420)} type="button">50%</button><button onClick={() => setCollateral(2130)} type="button">75%</button><button onClick={() => setCollateral(2840)} type="button">MAX</button></div>
        <label className="ticket-label" htmlFor="leverage">LEVERAGE <b>{leverage}×</b></label>
        <input className="leverage-slider" id="leverage" type="range" min="1" max="5" value={leverage} onChange={(event) => setLeverage(Number(event.target.value))} />
        <div className="leverage-labels"><span>1×</span><span>2×</span><span>3×</span><span>4×</span><span>5×</span></div>
        <div className="order-summary"><div><span>Position size</span><b>${position.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b></div><div><span>Est. entry <Info size={12} /></span><b>{entry.toFixed(2)}¢</b></div><div><span>Price impact</span><b>0.18%</b></div><div><span>Liquidation</span><b>{liquidation.toFixed(1)}¢</b></div><div><span>Trading fee</span><b>${(position * 0.0008).toFixed(2)}</b></div></div>
        <div className="risk-note"><ShieldCheck size={16} /><span><b>Protected mark active</b>Your liquidation uses a bounded mark, not the last trade.</span></div>
        <button className={`review-order ${side}`} type="button" onClick={() => setNotice(`Demo ${side} preview ready — connect a wallet to submit.`)}>Review {side}</button>
        {notice && <p className="order-notice" role="status">{notice}</p>}
      </aside>
    </div>
  );
}
