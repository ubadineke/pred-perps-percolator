import Link from "next/link";
import { ArrowRight, ArrowUpRight, Clock3, Layers, LineChart, Radio, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Sparkline } from "@/components/landing/sparkline";
import { PriceFormation } from "@/components/price-formation";
import { LinkButton } from "@/components/ui/button";
import { Badge, Container, LiveDot, MarketAvatar } from "@/components/ui/primitives";
import { getMarketChart, getMarkets, type ApiChartPoint } from "@/lib/api";
import { cents, centsChange, countdown } from "@/lib/format";
import { isTradable, type Market } from "@/lib/markets";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const steps = [
  { icon: LineChart, title: "Pick a market", text: "Every market is a real-world event, priced from 0¢ to 100¢ by how likely it is." },
  { icon: TrendingUp, title: "Go long or short", text: "Long if you think the chance is too low, short if it’s too high. One balance backs every position." },
  { icon: Clock3, title: "Exit any time", text: "Close whenever the price moves your way — or hold until the event resolves." },
];

const layers = [
  { icon: Radio, title: "Source index", text: "Live probabilities from external prediction markets anchor every price." },
  { icon: LineChart, title: "Moxie execution", text: "Inventory-aware quotes and a protected mark keep fills fair and margin honest." },
  { icon: Layers, title: "Percolator clearing", text: "Shared collateral, positions and solvency checks enforced on Solana." },
  { icon: ShieldCheck, title: "Event lifecycle", text: "Markets restrict, reduce and settle on schedule as the event approaches." },
];

export default async function Home() {
  const markets = await getMarkets().catch(() => [] as Market[]);
  const featured = markets.find(isTradable) ?? markets[0];
  const history: ApiChartPoint[] = featured ? await getMarketChart(featured.address, "1d").then((c) => c.mark).catch(() => []) : [];

  return (
    <AppShell>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_75%_30%,color-mix(in_srgb,var(--color-signal)_8%,transparent),transparent)]" />
        <Container className="relative grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-signal">
              <LiveDot /> Prediction perps on Solana
            </p>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.04] tracking-tighter text-foreground sm:text-6xl xl:text-[4.25rem]">
              Trade the probability,
              <span className="block text-muted">not just the outcome.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted">
              Go long or short on how likely real-world events are, with one shared margin account and risk controls built for markets that end.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/trade" size="lg">
                Start trading <ArrowRight className="size-4" aria-hidden="true" />
              </LinkButton>
              <LinkButton href="/markets" size="lg" variant="outline">
                Browse markets
              </LinkButton>
            </div>
          </div>

          {featured ? <FeaturedMarket market={featured} history={history} /> : <NoMarketsCard />}
        </Container>
      </section>

      {/* Live markets */}
      {markets.length > 1 ? (
        <section className="border-b border-border">
          <Container className="py-14">
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-tight">Live markets</h2>
              <Link href="/markets" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground">
                All markets <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {markets.slice(0, 6).map((market) => (
                <li key={market.slug}>
                  <Link href={`/trade/${market.slug}`} className="flex h-full items-start gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-2">
                    <MarketAvatar initials={market.initials} />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-medium leading-snug text-foreground">{market.question}</span>
                      <span className="mt-2 flex items-baseline gap-2 font-mono text-sm">
                        <span>{cents(market.mark)}</span>
                        <ChangeText value={market.stats.change24hCents} className="text-xs" />
                      </span>
                    </span>
                    <ArrowUpRight className="size-4 shrink-0 text-subtle" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}

      {/* How it works */}
      <section className="border-b border-border">
        <Container className="py-20">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-signal">How it works</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Markets have an opinion. Now you can trade it.</h2>
          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title}>
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-md border border-border-strong text-signal">
                    <step.icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-xs text-subtle">0{index + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* Price formation */}
      <section className="border-b border-border">
        <Container className="grid items-center gap-12 py-20 lg:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-signal">Price formation</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">One event, three prices.</h2>
            <dl className="mt-8 space-y-5">
              <div>
                <dt className="font-medium text-signal">Moxie price</dt>
                <dd className="mt-1 text-muted">Where you trade. Order flow moves it.</dd>
              </div>
              <div>
                <dt className="font-medium text-warning">Protected mark</dt>
                <dd className="mt-1 text-muted">What margin uses. It moves gradually, so one trade can’t trigger liquidations.</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Source index</dt>
                <dd className="mt-1 text-muted">The external market’s probability. It keeps Moxie anchored to reality.</dd>
              </div>
            </dl>
          </div>
          <PriceFormation />
        </Container>
      </section>

      {/* Under the hood */}
      <section className="border-b border-border">
        <Container className="py-20">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-signal">Under the hood</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Built to clear, not just to impress.</h2>
            </div>
            <Link href="/technology" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground">
              How Moxie works <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <ul className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {layers.map((layer) => (
              <li key={layer.title} className="bg-background p-6">
                <layer.icon className="size-5 text-signal" aria-hidden="true" />
                <h3 className="mt-5 font-semibold">{layer.title}</h3>
                <p className="mt-2 text-sm text-muted">{layer.text}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Closing */}
      <section>
        <Container className="flex flex-col items-start gap-6 py-20 md:flex-row md:items-center md:justify-between">
          <h2 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">The world moves before the chart does.</h2>
          <LinkButton href="/markets" size="lg">
            Find your market <ArrowRight className="size-4" aria-hidden="true" />
          </LinkButton>
        </Container>
      </section>
    </AppShell>
  );
}

function ChangeText({ value, className }: { value: number | null; className?: string }) {
  return <span className={cn(value === null || value === 0 ? "text-subtle" : value > 0 ? "text-long" : "text-short", className)}>{centsChange(value)}</span>;
}

function FeaturedMarket({ market, history }: { market: Market; history: ApiChartPoint[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface shadow-2xl shadow-black/40">
      <div className="flex items-start gap-3 border-b border-border p-5">
        <MarketAvatar initials={market.initials} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Badge>{market.providerLabel}</Badge>
            <Badge tone={market.status === 1 ? "long" : "warning"}>{market.lifecycle}</Badge>
          </div>
          <p className="mt-2 font-medium leading-snug text-foreground">{market.question}</p>
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs text-subtle">Moxie price</p>
            <p className="mt-1 font-mono text-4xl font-medium tracking-tight">{cents(market.mark)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-subtle">24h</p>
            <p className="mt-1 font-mono text-sm"><ChangeText value={market.stats.change24hCents} /></p>
          </div>
        </div>
        <Sparkline points={history} className="mt-4 h-28 w-full" />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <LinkButton href={`/trade/${market.slug}`} variant="long">
            <TrendingUp className="size-4" aria-hidden="true" /> Long · Yes
          </LinkButton>
          <LinkButton href={`/trade/${market.slug}`} variant="short">
            <TrendingDown className="size-4" aria-hidden="true" /> Short · No
          </LinkButton>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-subtle">
        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-long" aria-hidden="true" /> Protected mark</span>
        <span>Closes in <span className="font-mono text-muted">{countdown(market.closeTime)}</span></span>
      </div>
    </div>
  );
}

function NoMarketsCard() {
  return (
    <div className="rounded-xl border border-dashed border-border-strong p-8 text-center">
      <p className="font-medium">Markets are on their way</p>
      <p className="mt-1 text-sm text-muted">New markets appear here as soon as they’re admitted.</p>
    </div>
  );
}
