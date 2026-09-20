"use client";

import Link from "next/link";
import { ArrowRight, Clock3, RotateCcw, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const basePrices = [52,53,51,55,57,56,59,58,61,60,62,64,63,65,64,67,66,68,67,69,71,70,72,73];
const replay = [63.4,64.1,65.3,64.8,66.2,67.6,67.1,68.4];
type Side = "long" | "short";

export function TradePlayground() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [side,setSide] = useState<Side|null>(null);
  const [step,setStep] = useState(0);
  const [leverage,setLeverage] = useState(3);
  const entry = 63.4;
  const current = side ? replay[step] : entry;
  const pnl = side === "long" ? (current-entry)*leverage*3.7 : side === "short" ? (entry-current)*leverage*3.7 : 0;
  const points = useMemo(() => basePrices.map((price,index) => {
    const lift = side && index > 17 ? (current-entry)*((index-17)/6) : 0;
    return `${index*32},${188-(price+lift-48)*5.4}`;
  }).join(" "),[current,side]);

  useEffect(() => {
    if (!side) return;
    const timer = window.setInterval(() => setStep(value => (value+1)%replay.length),1050);
    return () => window.clearInterval(timer);
  },[side]);

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const card = cardRef.current;
    if (!card || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = card.getBoundingClientRect();
    const x = (event.clientX-box.left)/box.width-.5;
    const y = (event.clientY-box.top)/box.height-.5;
    card.style.setProperty("--tilt-x",`${-y*1.2}deg`);
    card.style.setProperty("--tilt-y",`${x*1.4}deg`);
    card.style.setProperty("--light-x",`${(x+.5)*100}%`);
    card.style.setProperty("--light-y",`${(y+.5)*100}%`);
  }

  function resetTilt() {
    cardRef.current?.style.setProperty("--tilt-x","0deg");
    cardRef.current?.style.setProperty("--tilt-y","0deg");
  }

  function openDemo(nextSide: Side) { setSide(nextSide); setStep(0); }

  return (
    <section className="professional-hero">
      <div className="hero-ambient" aria-hidden="true"><i/><i/><i/></div>
      <div className="professional-copy">
        <span className="professional-kicker"><i/> SOLANA-NATIVE PREDICTION PERPS</span>
        <h1>Trade conviction,<br/><em>not just outcomes.</em></h1>
        <p>Long or short the probability of real-world events with leverage, shared margin, and risk controls built for markets that eventually end.</p>
        <div className="professional-actions"><Link className="launch-action" href="/trade/sol-above-250-friday">Launch terminal <ArrowRight size={16}/></Link><Link className="explore-action" href="/markets">Explore markets</Link></div>
      </div>

      <div className="market-demo-stage">
        <div className="market-shadow-plane" aria-hidden="true"/>
        <div ref={cardRef} className="market-demo-card" onPointerMove={onPointerMove} onPointerLeave={resetTilt}>
          <div className="card-light" aria-hidden="true"/>
          <header className="demo-market-header">
            <div className="demo-identity"><span className="demo-symbol">SO</span><div><em>CRYPTO · JUPITER</em><h2>Will SOL trade above $250 by Friday?</h2></div></div>
            <div className="demo-price"><em>MOXIE PRICE</em><strong>{current.toFixed(1)}¢</strong><span>+8.2%</span></div>
          </header>
          <div className="contained-chart">
            <div className="chart-stats"><span><em>INDEX</em><b>61.8¢</b></span><span><em>MARK</em><b>62.3¢</b></span><span><em>24H VOL</em><b>$842K</b></span></div>
            <svg viewBox="0 0 736 210" preserveAspectRatio="none" role="img" aria-label="SOL above 250 price history">
              <defs><linearGradient id="containedArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d8ff70" stopOpacity=".2"/><stop offset="1" stopColor="#d8ff70" stopOpacity="0"/></linearGradient></defs>
              <g className="contained-grid"><path d="M0 42H736M0 84H736M0 126H736M0 168H736"/><path d="M147 0V210M294 0V210M441 0V210M588 0V210"/></g>
              <polyline className="contained-index" points="0,170 96,157 192,150 288,127 384,116 480,94 576,76 736,63"/>
              <polygon className="contained-area" points={`${points} 736,210 0,210`}/><polyline className="contained-line" points={points}/>
            </svg>
            {side && <div className="contained-entry"><i/><span>ENTRY {entry.toFixed(1)}¢</span></div>}
            <div className="contained-current"><i/><span>{current.toFixed(1)}¢</span></div>
          </div>
          {!side ? <div className="demo-controls">
            <div className="demo-side-buttons"><button type="button" onClick={() => openDemo("long")}><TrendingUp size={17}/><span><em>LONG</em><b>63.8¢</b></span></button><button type="button" onClick={() => openDemo("short")}><TrendingDown size={17}/><span><em>SHORT</em><b>63.0¢</b></span></button></div>
            <div className="demo-leverage"><span>LEVERAGE</span>{[1,2,3,4,5].map(value => <button key={value} className={leverage===value?"active":""} onClick={() => setLeverage(value)} type="button">{value}×</button>)}</div>
          </div> : <div className="demo-position">
            <div className="demo-position-values"><span><em>POSITION</em><b className={side}>{side.toUpperCase()} {leverage}×</b></span><span><em>ENTRY</em><b>{entry.toFixed(1)}¢</b></span><span><em>CURRENT</em><b>{current.toFixed(1)}¢</b></span><span><em>DEMO PNL</em><b className={pnl>=0?"positive":"negative"}>{pnl>=0?"+":""}${pnl.toFixed(2)}</b></span></div>
            <div className="demo-position-actions"><Link href="/trade/sol-above-250-friday">Open this market <ArrowRight size={14}/></Link><button onClick={() => {setSide(null);setStep(0);}} type="button"><RotateCcw size={13}/> Reset</button></div>
          </div>}
          <footer className="demo-footer"><span><ShieldCheck size={13}/> Protected mark active</span><span><Clock3 size={13}/> Locks in 2d 14h</span><em>Interactive demo · No wallet required</em></footer>
        </div>
      </div>
      <div className="hero-trust-line"><span>EXTERNAL PRICE ANCHOR</span><i/><span>SHARED USDC MARGIN</span><i/><span>EVENT-AWARE RISK</span></div>
    </section>
  );
}
