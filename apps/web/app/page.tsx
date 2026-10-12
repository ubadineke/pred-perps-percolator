import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Fingerprint, Infinity as InfinityIcon, Layers, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { LandingStage } from "@/components/landing-v2/landing-stage";
import { GlowCard, HeroCoins, PayoffSimulator, Reveal, TiltCard, type SimMarket } from "@/components/landing-v2/interactive";
import { getMarketChart, getMarkets, type ApiChartPoint } from "@/lib/api";
import { countdown, price, priceChange, usdShort } from "@/lib/format";
import { isTradable, type Market } from "@/lib/markets";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: { absolute: "Moxie — Trade what happens next" } };
export const dynamic = "force-dynamic";

/** Condensed heavy display type. */
const condensed = "font-display-condensed";

/** Lime highlighter behind a word. `inline` highlights each wrapped line separately. */
function Marker({ children, className, inline = false }: { children: ReactNode; className?: string; inline?: boolean }) {
  if (inline)
    return (
      <span className={cn("bg-[linear-gradient(transparent_16%,var(--color-signal)_16%,var(--color-signal)_94%,transparent_94%)] px-[0.06em] text-signal-foreground [-webkit-box-decoration-break:clone] [box-decoration-break:clone]", className)}>
        {children}
      </span>
    );
  return (
    <span className={cn("relative inline-block text-signal-foreground", className)}>
      <span aria-hidden="true" className="absolute inset-x-[-0.06em] bottom-[0.04em] top-[0.14em] -z-10 -rotate-[1.5deg] rounded-[0.06em] bg-signal" />
      {children}
    </span>
  );
}

export default async function Home() {
  const markets = await getMarkets().catch(() => [] as Market[]);
  const live = markets.filter(isTradable).length ? markets.filter(isTradable) : markets;
  const histories = await Promise.all(live.slice(0, 3).map((m) => getMarketChart(m.address, "1d").then((c) => c.mark).catch(() => [] as ApiChartPoint[])));
  const featured = live[0];
  const simMarkets: SimMarket[] = live.slice(0, 3).map((m) => ({ slug: m.slug, question: m.question, initials: m.initials, mark: m.mark }));
  const openInterest = markets.reduce((sum, m) => sum + m.stats.openInterestUsd, 0);

  return (
    <LandingStage className={cn("landing-light relative min-h-dvh overflow-x-clip bg-background text-foreground")}>
      <div aria-hidden="true" className="landing-grain pointer-events-none fixed inset-0 z-50 opacity-[0.05] mix-blend-multiply" />

      {/* Floating pill navigation */}
      <header className="fixed inset-x-0 top-4 z-40 px-4">
        <nav aria-label="Main" className="mx-auto flex max-w-5xl items-center justify-between gap-4 rounded-full border border-black/10 bg-white/70 py-2 pl-5 pr-2 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)] backdrop-blur-xl">
          <Link href="/" aria-label="Moxie home"><BrandMark /></Link>
          <div className="hidden items-center gap-1 text-sm text-muted md:flex">
            {[["Markets", "/markets"], ["Portfolio", "/portfolio"], ["Docs", "/docs"], ["How it works", "/docs/how-it-works"]].map(([label, href]) => (
              <Link key={href} href={href} className="rounded-full px-4 py-2 transition-colors hover:bg-black/5 hover:text-foreground">{label}</Link>
            ))}
          </div>
          <Link href="/trade" className="group inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03]">
            Launch app <ArrowRight className="size-4 text-[var(--accent-on-dark)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative isolate flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-4 pb-40 pt-32">
          <div aria-hidden="true" className="absolute inset-0 -z-20 bg-[radial-gradient(50%_40%_at_50%_42%,color-mix(in_srgb,var(--color-signal)_28%,transparent),transparent_70%),radial-gradient(35%_35%_at_88%_80%,color-mix(in_srgb,var(--color-signal)_14%,transparent),transparent_70%),radial-gradient(30%_30%_at_10%_20%,color-mix(in_srgb,var(--color-foreground)_6%,transparent),transparent_70%)]" />
          <div aria-hidden="true" className="absolute inset-0 -z-20 bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(70%_60%_at_50%_45%,black,transparent)]" />
          <div className="absolute inset-0 -z-10 hidden md:block"><HeroCoins /></div>

          <p className="animate-[rise_900ms_var(--ease-out)_both] inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-1.5 text-xs font-medium text-muted shadow-sm backdrop-blur">
            <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-long opacity-50" /><span className="relative inline-flex size-2 rounded-full bg-long" /></span>
            Prediction perps · Live on Solana devnet
          </p>

          <h1 className={cn(condensed, "relative isolate mt-7 text-center text-[calc(clamp(4.5rem,13vw,13.5rem)*var(--d-scale,1))]")}>
            <span className="block animate-[rise_1000ms_var(--ease-out)_120ms_both]">Trade what</span>
            <span className="block animate-[rise_1000ms_var(--ease-out)_240ms_both]">
              happens <Marker>next.</Marker>
            </span>
          </h1>

          <p className="mt-8 max-w-xl animate-[rise_1000ms_var(--ease-out)_360ms_both] text-center text-lg leading-8 text-muted sm:text-xl">
            Go long or short on football, crypto and culture. Live prices, one balance for every market, and you can exit the second you&rsquo;re right.
          </p>

          <div className="mt-10 flex animate-[rise_1000ms_var(--ease-out)_480ms_both] flex-wrap justify-center gap-3">
            <Link href="/trade" className="group inline-flex h-14 items-center gap-3 rounded-full bg-foreground pl-8 pr-2 text-base font-semibold text-white shadow-[0_20px_40px_-15px_rgba(0,0,0,0.45)] transition-transform hover:scale-[1.04]">
              Start trading
              <span className="grid size-10 place-items-center rounded-full bg-signal text-signal-foreground transition-transform group-hover:rotate-[-45deg]"><ArrowRight className="size-5" aria-hidden="true" /></span>
            </Link>
            <Link href="/markets" className="inline-flex h-14 items-center rounded-full border border-black/10 bg-white px-8 text-base font-medium shadow-sm transition-colors hover:bg-surface-2">
              Browse markets
            </Link>
          </div>

          {/* Floating live market cards */}
          {live.slice(0, 2).map((market, index) => (
            <div
              key={market.slug}
              className={cn(
                "absolute hidden xl:block",
                index === 0 ? "bottom-24 left-[4%] animate-[drift_7s_ease-in-out_infinite] [--r:-6deg]" : "bottom-36 right-[4%] animate-[drift_8s_ease-in-out_1s_infinite] [--r:5deg]",
              )}
            >
              <TiltCard style={{ transform: `rotate(var(--r))` }}>
                <HeroMarketCard market={market} history={histories[index] ?? []} />
              </TiltCard>
            </div>
          ))}
        </section>

        {/* Ticker band */}
        <section aria-label="Live prices" className="relative z-10 -mt-10 -rotate-2 overflow-hidden border-y-2 border-foreground bg-signal py-4 text-signal-foreground shadow-[0_20px_60px_-25px_color-mix(in_srgb,var(--color-signal)_80%,transparent)]">
          <div className="flex w-max animate-[marquee_32s_linear_infinite] motion-reduce:animate-none">
            {[0, 1].map((copy) => (
              <div key={copy} className={cn(condensed, "flex shrink-0 items-center gap-10 pr-10 text-[calc(1.875rem*var(--d-scale,1))]")} aria-hidden={copy === 1}>
                {live.map((m) => (
                  <span key={`${copy}-${m.slug}`} className="flex items-center gap-4 whitespace-nowrap">
                    {m.question} <span className="font-mono text-2xl font-bold normal-case [font-stretch:100%]">{price(m.mark)}</span>
                    <Sparkles className="size-6" aria-hidden="true" />
                  </span>
                ))}
                {["Go long", "Go short", "Exit any time", "One balance"].map((phrase) => (
                  <span key={`${copy}-${phrase}`} className="flex items-center gap-4 whitespace-nowrap">
                    {phrase} <Sparkles className="size-6" aria-hidden="true" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* Simulator */}
        <section className="relative px-4 py-32 sm:py-40">
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
            <Reveal className="min-w-0">
              <p className="inline-flex rounded-full bg-foreground px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-on-dark)]">Make the call</p>
              <h2 className={cn(condensed, "relative isolate mt-5 text-[calc(clamp(3.5rem,7vw,6.5rem)*var(--d-scale,1))]")}>
                Pick a side.<br />Drag the price.<br /><Marker inline>Watch it pay.</Marker>
              </h2>
              <p className="mt-6 max-w-md text-lg leading-8 text-muted">
                Every contract trades between $0 and $1 and follows the real-world odds. Think the market&rsquo;s wrong? Go long or short and close whenever you like — no waiting for the final whistle.
              </p>
            </Reveal>
            <Reveal delay={150} className="min-w-0">
              <PayoffSimulator markets={simMarkets} />
            </Reveal>
          </div>
        </section>

        {/* Spotlight: the one dark panel on the page */}
        {featured ? (
          <section className="px-4 pb-32">
            <Reveal className="mx-auto max-w-6xl">
              <div className="landing-dark relative overflow-hidden rounded-[2.5rem] bg-[#0b0d0e] p-8 text-foreground shadow-[0_50px_100px_-40px_rgba(0,0,0,0.6)] sm:p-12">
                <div aria-hidden="true" className="absolute -right-32 -top-32 size-[28rem] rounded-full bg-signal/20 blur-3xl" />
                <div className="relative flex flex-wrap items-center justify-between gap-4">
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-muted">
                    {eventOpen(featured) ? <span className="size-2 animate-pulse rounded-full bg-short" /> : <span className="size-2 rounded-full bg-subtle" />}
                    {eventOpen(featured) ? "Live now" : "Event closed · awaiting result"} · {featured.providerLabel}
                  </p>
                  {eventOpen(featured) ? <p className="font-mono text-sm text-muted">Closes in <span className="text-warning">{countdown(featured.closeTime)}</span></p> : null}
                </div>
                <h2 className="relative mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">{featured.question}</h2>
                <div className="relative mt-10 grid items-end gap-10 lg:grid-cols-[auto_1fr]">
                  <div>
                    <p className="font-mono text-[clamp(4rem,9vw,7.5rem)] font-medium leading-none tracking-tighter">{price(featured.mark)}</p>
                    <p className={cn("mt-3 font-mono text-lg", (featured.stats.change24hCents ?? 0) >= 0 ? "text-long" : "text-short")}>
                      {priceChange(featured.stats.change24hCents, featured.mark)} <span className="text-subtle">today</span>
                    </p>
                  </div>
                  <AreaChart points={histories[0] ?? []} className="h-40 w-full" />
                </div>
                <div className="relative mt-10 grid gap-3 sm:grid-cols-2">
                  <Link href={`/trade/${featured.slug}`} className="flex h-16 items-center justify-between rounded-2xl bg-long px-6 text-lg font-semibold text-long-foreground transition-transform hover:scale-[1.015]">
                    Long · Yes <span className="font-mono">{price(featured.mark)}</span>
                  </Link>
                  <Link href={`/trade/${featured.slug}`} className="flex h-16 items-center justify-between rounded-2xl bg-short px-6 text-lg font-semibold text-short-foreground transition-transform hover:scale-[1.015]">
                    Short · No <span className="font-mono">{price(100 - featured.mark)}</span>
                  </Link>
                </div>
              </div>
            </Reveal>
          </section>
        ) : null}

        {/* Bento */}
        <section className="px-4 pb-32">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <h2 className={cn(condensed, "relative isolate max-w-3xl text-[calc(clamp(3rem,6vw,5.5rem)*var(--d-scale,1))]")}>
                Built for people<br />who <Marker inline>call it early.</Marker>
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              <Reveal className="min-w-0 md:col-span-2">
                <GlowCard className="h-full">
                  <div className="flex h-full flex-col justify-between gap-10 p-8">
                    <div>
                      <IconChip><Layers className="size-5" aria-hidden="true" /></IconChip>
                      <h3 className="mt-5 text-2xl font-semibold">One balance. Every market.</h3>
                      <p className="mt-2 max-w-md text-muted">Deposit once and trade football, crypto and culture from the same collateral. No juggling accounts.</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {live.slice(0, 3).map((m) => (
                        <span key={m.slug} className="inline-flex min-w-0 items-center gap-2 rounded-full border border-black/10 bg-surface-2 py-1.5 pl-1.5 pr-4 text-sm">
                          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-foreground font-mono text-[11px] text-[var(--accent-on-dark)]">{m.initials}</span>
                          <span className="max-w-[14rem] truncate">{m.question}</span>
                          <span className="font-mono text-muted">{price(m.mark)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </GlowCard>
              </Reveal>
              <BentoCard delay={80} icon={<Zap className="size-5" aria-hidden="true" />} title="Exit any second" text="No expiry to wait for. Close the moment the price moves your way." big="24/7" />
              <BentoCard delay={0} icon={<ShieldCheck className="size-5" aria-hidden="true" />} title="Can’t go below zero" text="Every position is fully collateralised. You never lose more than you put in." big="100%" />
              <BentoCard delay={80} icon={<InfinityIcon className="size-5" aria-hidden="true" />} title="Priced off real odds" text="Prices track the source prediction market, kept in line by funding." big="Live" />
              <BentoCard delay={160} icon={<Fingerprint className="size-5" aria-hidden="true" />} title="Rules locked on-chain" text="Each market’s resolution rules are fingerprinted on Solana when it lists. Nobody can change them later." big="✓" />
            </div>
          </div>
        </section>

        {/* Final call */}
        <section className="relative overflow-hidden px-4 pb-24 pt-10">
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-[radial-gradient(50%_60%_at_50%_70%,color-mix(in_srgb,var(--color-signal)_25%,transparent),transparent_70%)]" />
          <Reveal className="mx-auto max-w-6xl text-center">
            <p className={cn(condensed, "text-[calc(clamp(6rem,22vw,20rem)*var(--d-scale,1))] text-transparent [-webkit-text-stroke:2px_rgba(13,15,16,0.18)]")}>Your</p>
            <p className={cn(condensed, "relative isolate -mt-4 text-[calc(clamp(6rem,22vw,20rem)*var(--d-scale,1))]")}><Marker>call.</Marker></p>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6">
              <Link href="/trade" className="group inline-flex h-16 items-center gap-3 rounded-full bg-foreground pl-10 pr-2 text-lg font-semibold text-white transition-transform hover:scale-[1.04]">
                Start trading
                <span className="grid size-12 place-items-center rounded-full bg-signal text-signal-foreground transition-transform group-hover:rotate-[-45deg]"><ArrowRight className="size-5" aria-hidden="true" /></span>
              </Link>
              <p className="text-sm text-muted">
                {live.length} live market{live.length === 1 ? "" : "s"} · {usdShort(openInterest)} open interest · free test funds
              </p>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-black/10 px-4 py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <BrandMark />
            <span className="text-xs text-subtle">Experimental · Solana devnet · Test funds only</span>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            <Link className="hover:text-foreground" href="/markets">Markets</Link>
            <Link className="hover:text-foreground" href="/portfolio">Portfolio</Link>
            <Link className="hover:text-foreground" href="/docs">Docs</Link>
            <a className="inline-flex items-center gap-1 hover:text-foreground" href="https://panta.market" target="_blank" rel="noreferrer">Powered by Panta <ArrowUpRight className="size-3.5" aria-hidden="true" /></a>
          </nav>
        </div>
      </footer>
    </LandingStage>
  );
}

const eventOpen = (market: Market) => market.closeTime > Date.now() / 1000;

function IconChip({ children }: { children: ReactNode }) {
  return <span className="grid size-11 place-items-center rounded-2xl bg-signal text-signal-foreground shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)]">{children}</span>;
}

function HeroMarketCard({ market, history }: { market: Market; history: ApiChartPoint[] }) {
  const change = market.stats.change24hCents ?? 0;
  return (
    <Link href={`/trade/${market.slug}`} className="block w-72 rounded-3xl border border-black/5 bg-white/90 p-5 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.25)] backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-foreground font-mono text-xs font-bold text-[var(--accent-on-dark)]">{market.initials}</span>
        <p className="line-clamp-2 text-sm font-medium leading-snug">{market.question}</p>
      </div>
      <div className="mt-5 flex items-end justify-between">
        <p className="font-mono text-3xl font-medium tracking-tight">{price(market.mark)}</p>
        <p className={cn("font-mono text-sm", change >= 0 ? "text-long" : "text-short")}>{priceChange(market.stats.change24hCents, market.mark)}</p>
      </div>
      <AreaChart points={history} stroke="var(--color-foreground)" className="mt-3 h-12 w-full" />
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm font-semibold">
        <span className="rounded-xl bg-long/10 py-2 text-center text-long">Long</span>
        <span className="rounded-xl bg-short/10 py-2 text-center text-short">Short</span>
      </div>
    </Link>
  );
}

function BentoCard({ icon, title, text, big, delay }: { icon: ReactNode; title: string; text: string; big: string; delay: number }) {
  return (
    <Reveal delay={delay} className="min-w-0">
      <GlowCard className="h-full">
        <div className="flex h-full flex-col p-8">
          <IconChip>{icon}</IconChip>
          <p className={cn(condensed, "mt-6 text-[calc(3.75rem*var(--d-scale,1))]")}>{big}</p>
          <h3 className="mt-4 text-xl font-semibold">{title}</h3>
          <p className="mt-2 text-muted">{text}</p>
        </div>
      </GlowCard>
    </Reveal>
  );
}

/** Smooth area chart of mark history. Flat or missing data draws a gentle line. */
function AreaChart({ points, className, stroke = "var(--color-signal)" }: { points: ApiChartPoint[]; className?: string; stroke?: string }) {
  const width = 600;
  const height = 160;
  const values = points.map((p) => p.value);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const span = Math.max(max - min, 2);
  const mid = (min + max) / 2;
  const y = (v: number) => height / 2 - ((v - mid) / span) * (height - 30);
  const coords = points.length > 1 ? points.map((p, i) => [(i / (points.length - 1)) * width, y(p.value)] as const) : [[0, height / 2], [width, height / 2]] as const;
  const line = coords.map(([x, yy], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${yy.toFixed(1)}`).join(" ");
  const id = `area-${Math.round(min * 100)}-${points.length}-${stroke.length}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-signal)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--color-signal)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${width} ${height} L0 ${height} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
