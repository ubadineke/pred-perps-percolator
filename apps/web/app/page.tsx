import Link from "next/link";
import { ArrowRight, Braces, Clock3, Radio, ShieldCheck } from "lucide-react";
import { PriceFormation } from "@/components/price-formation";
import { SiteHeader } from "@/components/site-header";
import { TradePlayground } from "@/components/trade-playground";
import { getMarkets } from "@/lib/api";

export default async function Home() {
  const markets=await getMarkets().catch(()=>[]);
  const terminalHref=markets[0]?`/trade/${markets[0].slug}`:"/markets";
  return (
    <main className="landing">
      <SiteHeader floating />
      <TradePlayground />

      <section className="live-strip" aria-label="Live markets">
        <span className="live-label"><i /> LIVE</span>
        {markets.slice(0, 3).map((market) => (
          <Link href={`/trade/${market.slug}`} key={market.slug}>
            <span>{market.short}</span>
            <b>{market.moxie.toFixed(1)}¢</b>
            <em>{market.change===null?"CHAIN":`${market.change>=0?"+":""}${market.change}%`}</em>
          </Link>
        ))}
        <Link className="all-markets" href="/markets">All markets <ArrowRight size={14} /></Link>
      </section>

      <section className="manifesto section-shell">
        <p className="section-index">01 / THESIS</p>
        <div>
          <h2>Markets have an opinion.<br /><span>So should the price.</span></h2>
          <p>External venues define the event and anchor reality. Moxie traders define the perp price between now and resolution.</p>
        </div>
      </section>

      <section id="mechanism" className="mechanism section-shell">
        <div className="section-heading">
          <p className="section-index">02 / PRICE FORMATION</p>
          <h2>One event.<br />Three signals.</h2>
          <p>Order flow moves the Moxie price. A protected mark keeps margin honest. The external index keeps the system grounded.</p>
        </div>
        <PriceFormation />
      </section>

      <section className="terminal-preview section-shell">
        <div className="terminal-copy">
          <p className="section-index">03 / EXECUTION</p>
          <h2>A terminal built for what happens next.</h2>
          <p>Price, pressure, time and risk—visible before you sign.</p>
          <Link className="text-link" href={terminalHref}>Open the terminal <ArrowRight size={16} /></Link>
        </div>
        <div className="terminal-window">
          <div className="window-top"><span><i /><i /><i /></span><b>MOXIE / SOL &gt; $250</b><em>ORACLE LIVE</em></div>
          <div className="window-body">
            <div className="mini-market">
              <span>MOXIE PRICE</span><strong>63.4¢</strong><em>+8.2%</em>
              <div className="mini-chart"><svg viewBox="0 0 500 160" preserveAspectRatio="none"><path d="M0 128 C40 120 52 142 90 110 S150 86 180 101 S230 120 260 76 S300 92 340 55 S390 69 420 32 S470 43 500 18" /></svg></div>
              <div className="chart-legend"><span>INDEX 61.8</span><span>MARK 62.3</span><span>MOXIE 63.4</span></div>
            </div>
            <div className="mini-ticket">
              <div className="ticket-tabs"><b>LONG</b><span>SHORT</span></div>
              <label>COLLATERAL <span>AVAILABLE $2,840</span></label>
              <div className="fake-input"><span>500.00</span><b>USDC</b></div>
              <label>LEVERAGE <span>3×</span></label>
              <div className="leverage-track"><i /></div>
              <dl><div><dt>Position</dt><dd>$1,500</dd></div><div><dt>Est. entry</dt><dd>63.7¢</dd></div><div><dt>Liquidation</dt><dd>43.1¢</dd></div></dl>
              <button type="button">Review long</button>
            </div>
          </div>
        </div>
      </section>

      <section className="architecture section-shell">
        <div className="section-heading compact-heading">
          <p className="section-index">04 / UNDER THE SURFACE</p>
          <h2>Built to clear,<br />not just impress.</h2>
        </div>
        <div className="architecture-line">
          <article><Radio /><span>01</span><h3>Provider index</h3><p>Normalized external probability and executable depth.</p></article>
          <i />
          <article><Braces /><span>02</span><h3>Moxie execution</h3><p>Inventory-aware pricing, matching and protected marks.</p></article>
          <i />
          <article><ShieldCheck /><span>03</span><h3>Percolator clearing</h3><p>Shared margin, position accounting and solvency checks.</p></article>
          <i />
          <article><Clock3 /><span>04</span><h3>Event lifecycle</h3><p>Risk states that understand markets eventually end.</p></article>
        </div>
      </section>

      <section className="closing">
        <div className="closing-ring" aria-hidden="true"><i /><i /><i /></div>
        <p>THE WORLD MOVES<br />BEFORE THE CHART DOES.</p>
        <Link href="/markets">Find your market <ArrowRight size={18} /></Link>
      </section>
      <footer><span>© 2026 MOXIE</span><span>DEVNET · EXPERIMENTAL</span><div><Link href="/technology">Technology</Link><a href="#">Risk</a><a href="#">GitHub</a></div></footer>
    </main>
  );
}
