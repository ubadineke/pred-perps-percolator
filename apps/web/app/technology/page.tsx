import { Braces, DatabaseZap, Radio, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";

const layers = [
  { icon: Radio, n: "01", title: "Provider adapters", text: "Normalize event identity, probabilities, depth and lifecycle signals from external prediction venues." },
  { icon: DatabaseZap, n: "02", title: "Authenticated oracle", text: "Validate freshness and provenance before publishing a bounded probability mark on Solana." },
  { icon: Braces, n: "03", title: "Moxie execution", text: "Produce inventory-aware quotes and bind every fill to its market, policy and oracle observation." },
  { icon: ShieldCheck, n: "04", title: "Percolator clearing", text: "Maintain shared collateral, positions, PnL and solvency invariants beneath the product layer." },
];

export default function TechnologyPage() {
  return <AppShell><div className="technology-page">
    <section className="technology-hero"><p className="eyebrow">THE ENGINE</p><h1>Every trade has<br/><span>a chain of proof.</span></h1><p>Moxie separates event discovery, price formation and solvency—then makes the boundary between them visible.</p><div className="tech-status"><span><i/> ORACLE REPORTER</span><span><i/> MATCHER</span><span><i/> PERCOLATOR</span><em>DEVNET PREVIEW</em></div></section>
    <section className="tech-layers">{layers.map(({ icon: Icon, n, title, text }, index) => <article key={title}><div><Icon/><span>{n}</span></div><h2>{title}</h2><p>{text}</p>{index < layers.length - 1 && <i className="layer-connector"/>}</article>)}</section>
    <section className="truth-table"><div><p className="section-index">RESPONSIBILITY BOUNDARIES</p><h2>Know what moves what.</h2></div><dl><div><dt>External venue</dt><dd>Event definition and reference probability</dd></div><div><dt>Moxie market</dt><dd>Execution price and internal order-flow signal</dd></div><div><dt>Protected mark</dt><dd>Margin valuation and liquidation safety</dd></div><div><dt>Percolator</dt><dd>Collateral, clearing and solvency accounting</dd></div></dl></section>
  </div></AppShell>;
}
