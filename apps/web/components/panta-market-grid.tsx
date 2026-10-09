import { ArrowUpRight } from "lucide-react";
import type { ApiPantaMarket, ApiProviderStatus } from "@/lib/api";
import { Badge, EmptyState, LiveDot } from "./ui/primitives";

const probability = (value?: number) => (value === undefined ? "—" : `${(value / 10_000).toFixed(1)}%`);
const volume = (value?: string) => {
  if (!value) return "—";
  const amount = Number(value) / 1_000_000;
  if (!Number.isFinite(amount) || amount === 0) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(amount);
};
const closesIn = (closeMs: number) => {
  const remaining = closeMs - Date.now();
  if (remaining <= 0) return "Closed";
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  return days ? `${days}d ${hours}h` : `${hours}h`;
};

/** Source markets from Panta: reference prices only, not tradable on Moxie until admitted. */
export function PantaMarketGrid({ markets, status }: { markets: ApiPantaMarket[]; status?: ApiProviderStatus }) {
  const open = markets.filter((market) => market.status === "open");
  return (
    <section aria-labelledby="source-heading" className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="source-heading" className="text-xl font-semibold tracking-tight">Source markets</h2>
          <p className="mt-1 text-sm text-muted">Live events on Panta. Reference prices only — a market becomes tradable on Moxie once it’s admitted.</p>
        </div>
        <span className="inline-flex items-center gap-2 text-xs text-muted">
          <LiveDot tone={status?.stale ? "warning" : "long"} />
          {status?.stale ? "Panta feed delayed" : "Panta feed live"}
        </span>
      </div>
      {open.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {open.map((market) => (
            <li key={market.providerMarketId} className="flex flex-col rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <Badge>{market.category ?? "Event"}</Badge>
                <span className="text-xs text-subtle">Closes in <span className="font-mono">{closesIn(market.closeTime)}</span></span>
              </div>
              <h3 className="mt-3 line-clamp-2 text-sm font-medium leading-snug text-foreground">{market.title}</h3>
              <dl className="mt-auto grid grid-cols-3 gap-2 pt-4">
                <div>
                  <dt className="text-xs text-subtle">Yes</dt>
                  <dd className="mt-0.5 font-mono text-sm text-long">{probability(market.indexPriceE6)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-subtle">No</dt>
                  <dd className="mt-0.5 font-mono text-sm text-short">{market.indexPriceE6 === undefined ? "—" : probability(1_000_000 - market.indexPriceE6)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-subtle">Volume</dt>
                  <dd className="mt-0.5 font-mono text-sm text-muted">{volume(market.volumeUsdE6)}</dd>
                </div>
              </dl>
              {market.sourceUrl ? (
                <a href={market.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 self-start text-xs font-medium text-muted hover:text-foreground">
                  View on Panta <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-border">
          <EmptyState title="No open source markets right now" description="Panta’s catalog has no open events at the moment." />
        </div>
      )}
    </section>
  );
}
