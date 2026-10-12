"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { FEE_BPS, planOrder, type Side } from "../../../../packages/sdk/src/trading";
import { cn } from "@/lib/utils";
import { useCoinColors } from "./landing-stage";

const CoinScene = dynamic(() => import("./coin-scene"), { ssr: false });

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);
  return reduced;
}

/** 3D coins behind the hero. Skipped entirely when WebGL isn't available. */
export function HeroCoins() {
  const reduced = usePrefersReducedMotion();
  const colors = useCoinColors();
  const [webgl, setWebgl] = useState(false);
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      setWebgl(Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl")));
    } catch {
      setWebgl(false);
    }
  }, []);
  if (!webgl) return null;
  return (
    <div aria-hidden="true" className="absolute inset-0 animate-[fade-in_1.2s_ease-out_both]">
      <CoinScene reducedMotion={reduced} colors={colors} />
    </div>
  );
}

/** Card that tilts toward the pointer. */
export function TiltCard({ children, className, style, max = 10 }: { children: ReactNode; className?: string; style?: CSSProperties; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("");
  return (
    <div
      ref={ref}
      style={{ ...style, transform: `${style?.transform ?? ""} ${transform}`, transition: transform ? "transform 80ms linear" : "transform 600ms var(--ease-out)" }}
      className={className}
      onPointerMove={(event) => {
        const rect = ref.current!.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        setTransform(`perspective(900px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg) scale(1.02)`);
      }}
      onPointerLeave={() => setTransform("")}
    >
      {children}
    </div>
  );
}

/** Card whose border lights up where the pointer is. */
export function GlowCard({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onPointerMove={(event) => {
        const rect = ref.current!.getBoundingClientRect();
        ref.current!.style.setProperty("--gx", `${event.clientX - rect.left}px`);
        ref.current!.style.setProperty("--gy", `${event.clientY - rect.top}px`);
      }}
      className={cn(
        "group relative rounded-3xl p-px",
        "bg-[radial-gradient(420px_circle_at_var(--gx,50%)_var(--gy,0%),color-mix(in_srgb,var(--color-signal)_90%,black_8%),var(--color-border)_45%)] shadow-[0_20px_50px_-30px_rgba(0,0,0,0.25)]",
        className,
      )}
    >
      <div className="relative h-full overflow-hidden rounded-[calc(1.5rem-1px)] bg-surface">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-[radial-gradient(500px_circle_at_var(--gx,50%)_var(--gy,0%),color-mix(in_srgb,var(--color-signal)_22%,transparent),transparent_60%)]" />
        {children}
      </div>
    </div>
  );
}

/** Fades and lifts its children in when they scroll into view. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => entry?.isIntersecting && (setVisible(true), observer.disconnect()), { rootMargin: "0px 0px -10% 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn("transition-[opacity,transform] duration-[900ms] ease-[var(--ease-out)] motion-reduce:transition-none", visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0", className)}
    >
      {children}
    </div>
  );
}

/** A number that rolls to its new value instead of snapping. */
export function RollingNumber({ value, format, className }: { value: number; format: (v: number) => string; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / 450, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = origin + (value - origin) * eased;
      setShown(next);
      from.current = next;
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span className={cn("font-mono tabular-nums", className)}>{format(shown)}</span>;
}

export type SimMarket = { slug: string; question: string; initials: string; mark: number };

const money = (v: number) => `${v < 0 ? "−" : "+"}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dollars = (cents: number) => `$${(cents / 100).toFixed(3)}`;

/** "Make the call": pick a side and amount, drag where the price goes, watch the PnL. */
export function PayoffSimulator({ markets }: { markets: SimMarket[] }) {
  const [marketIndex, setMarketIndex] = useState(0);
  const market = markets[marketIndex] ?? { slug: "", question: "Example market", initials: "EX", mark: 50 };
  const [side, setSide] = useState<Side>("long");
  const [amount, setAmount] = useState(100);
  const [target, setTarget] = useState(Math.min(Math.round(market.mark + 20), 95));

  useEffect(() => setTarget(Math.min(Math.round(market.mark + (side === "long" ? 20 : -20)), 95)), [market.mark, side]);

  const result = useMemo(() => {
    const plan = planOrder(side, amount, market.mark);
    if (!plan) return null;
    const direction = side === "long" ? 1 : -1;
    const closeFee = (plan.contracts * (target / 100) * Number(FEE_BPS)) / 10_000;
    const pnl = plan.contracts * ((target - market.mark) / 100) * direction - plan.feeUsd - closeFee;
    return { contracts: plan.contracts, pnl, returnPct: (pnl / amount) * 100 };
  }, [side, amount, market.mark, target]);

  const winning = (result?.pnl ?? 0) >= 0;
  const entryLeft = `${market.mark}%`;
  const targetLeft = `${target}%`;

  return (
    <div className="rounded-[2rem] border border-black/5 bg-surface p-5 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.3)] sm:p-7">
      {markets.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Market">
          {markets.map((m, index) => (
            <button
              key={m.slug}
              type="button"
              role="radio"
              aria-checked={index === marketIndex}
              onClick={() => setMarketIndex(index)}
              className={cn("flex min-w-0 max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors", index === marketIndex ? "border-foreground bg-signal text-signal-foreground" : "border-black/10 text-muted hover:text-foreground")}
            >
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-foreground font-mono text-[10px] text-[var(--accent-on-dark)]">{m.initials}</span>
              <span className="truncate">{m.question}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">{market.question}</p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-surface-2 p-1.5" role="radiogroup" aria-label="Side">
        {(["long", "short"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={side === value}
            onClick={() => setSide(value)}
            className={cn(
              "h-12 rounded-xl text-base font-semibold transition-all duration-300",
              side === value ? (value === "long" ? "bg-long text-long-foreground shadow-[0_0_40px_-8px_var(--color-long)]" : "bg-short text-short-foreground shadow-[0_0_40px_-8px_var(--color-short)]") : "text-muted hover:text-foreground",
            )}
          >
            <span className="sm:hidden">{value === "long" ? "Long" : "Short"}</span>
            <span className="hidden sm:inline">{value === "long" ? "Long · price goes up" : "Short · price goes down"}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted">You put in</span>
        <div className="flex flex-wrap gap-1.5">
          {[50, 100, 250, 500].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setAmount(value)}
              aria-pressed={amount === value}
              className={cn("h-9 rounded-full px-3.5 font-mono text-sm transition-colors", amount === value ? "bg-foreground text-white" : "bg-surface-2 text-muted hover:text-foreground")}
            >
              ${value}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted">
            Enter at <span className="font-mono text-foreground">{dollars(market.mark)}</span>
          </span>
          <span className="text-muted">
            Price moves to <span className="font-mono text-lg text-foreground">{dollars(target)}</span>
          </span>
        </div>
        <div className="relative mt-4 h-12">
          <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-black/10" />
          <div
            className={cn("absolute top-1/2 h-2 -translate-y-1/2 rounded-full transition-colors", winning ? "bg-long" : "bg-short")}
            style={{ left: `min(${entryLeft}, ${targetLeft})`, width: `${Math.abs(target - market.mark)}%` }}
          />
          <div className="absolute top-1/2 h-6 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-foreground/70" style={{ left: entryLeft }} aria-hidden="true" />
          <input
            type="range"
            min={1}
            max={99}
            step={0.5}
            value={target}
            onChange={(event) => setTarget(Number(event.target.value))}
            aria-label="Where the price moves to"
            className="sim-range absolute inset-0 w-full cursor-grab appearance-none bg-transparent active:cursor-grabbing"
          />
        </div>
        <div className="flex justify-between font-mono text-xs text-subtle">
          <span>$0</span>
          <span>$1</span>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4 border-t border-black/10 pt-6">
        <div>
          <p className="text-sm text-muted">Your profit or loss</p>
          <RollingNumber value={result?.pnl ?? 0} format={money} className={cn("mt-1 block text-5xl font-semibold tracking-tight transition-colors sm:text-6xl", winning ? "text-long" : "text-short")} />
        </div>
        <div className="text-right text-sm">
          <p className="text-muted">
            <RollingNumber value={result?.contracts ?? 0} format={(v) => v.toFixed(0)} className="text-foreground" /> contracts
          </p>
          <p className={cn("mt-1 font-mono", winning ? "text-long" : "text-short")}>
            <RollingNumber value={result?.returnPct ?? 0} format={(v) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(0)}%`} /> return
          </p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-subtle">Includes the 0.3% fee to open and close. Before funding. Test funds on devnet.</p>
        {market.slug ? (
          <Link href={`/trade/${market.slug}`} className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03]">
            Make this trade →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
