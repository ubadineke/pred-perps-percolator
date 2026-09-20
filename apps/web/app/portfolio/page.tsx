import { ArrowDownLeft, ArrowUpRight, Clock3, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app-shell";

export default function PortfolioPage() {
  return (
    <AppShell><div className="page-container portfolio-page">
      <div className="page-title"><div><p className="eyebrow">SHARED MARGIN</p><h1>Portfolio</h1><p>One collateral account across every active prediction perp.</p></div><div className="portfolio-actions"><button type="button"><ArrowDownLeft size={16}/> Deposit</button><button type="button"><ArrowUpRight size={16}/> Withdraw</button></div></div>
      <div className="equity-grid">
        <article className="equity-main"><span>PORTFOLIO EQUITY</span><strong>$3,435.07</strong><em className="positive">+$112.46 today</em><div className="equity-line"><i/><i/><i/><i/><i/><i/></div></article>
        <article><span>AVAILABLE COLLATERAL</span><strong>$2,840.40</strong><small>82.7% available</small></article>
        <article><span>TOTAL NOTIONAL</span><strong>$1,500.00</strong><small>3× average leverage</small></article>
        <article><span>MARGIN UTILIZATION</span><strong>17.3%</strong><div className="util-bar"><i /></div></article>
      </div>
      <div className="portfolio-columns">
        <section className="portfolio-panel"><header><div><h2>Open positions</h2><span>1 ACTIVE</span></div><button type="button">View history</button></header><div className="portfolio-position"><div className="position-name"><i>L</i><span><b>SOL &gt; $250</b><em>3× LONG · Locks in 2d 14h</em></span></div><dl><div><dt>SIZE</dt><dd>$1,500.00</dd></div><div><dt>ENTRY</dt><dd>58.6¢</dd></div><div><dt>MARK</dt><dd>62.3¢</dd></div><div><dt>PNL</dt><dd className="positive">+$94.67</dd></div></dl></div></section>
        <aside className="health-card"><div className="health-ring"><span><b>82</b>/100</span></div><h2>Healthy</h2><p>Your account can absorb a 39.7% adverse move before liquidation.</p><dl><div><dt>Maintenance margin</dt><dd>$260.00</dd></div><div><dt>Liquidation buffer</dt><dd>$2,580.40</dd></div><div><dt>Next lock event</dt><dd><Clock3 size={13}/> 2d 14h</dd></div></dl></aside>
      </div>
      <div className="empty-activity"><WalletCards size={24}/><div><b>No recent account activity</b><span>Deposits, withdrawals and settlements will appear here.</span></div></div>
    </div></AppShell>
  );
}
