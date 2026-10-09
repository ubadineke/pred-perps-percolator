import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Market } from "@/lib/markets";
import { cents, centsChange, countdown, usdShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge, MarketAvatar } from "./ui/primitives";

function lifecycleTone(market: Market) {
  if (market.status === 1) return "long" as const;
  if (market.status === 2 || market.status === 3) return "warning" as const;
  return "neutral" as const;
}

function changeTone(value: number | null) {
  if (value === null || value === 0) return "text-subtle";
  return value > 0 ? "text-long" : "text-short";
}

function IndexCell({ market }: { market: Market }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={market.indexStale ? "Source price has not updated recently" : undefined}>
      {cents(market.index)}
      {market.indexStale ? <span className="text-xs font-sans text-warning">paused</span> : null}
    </span>
  );
}

export function MarketTable({ markets }: { markets: Market[] }) {
  return (
    <>
      {/* Desktop / tablet: table */}
      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-subtle">
              <th scope="col" className="px-5 py-3 font-medium">Market</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Price</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">24h</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Source index</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">24h volume</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Open interest</th>
              <th scope="col" className="px-5 py-3 text-right font-medium">Closes in</th>
            </tr>
          </thead>
          <tbody>
            {markets.map((market) => (
              <tr key={market.slug} className="group border-b border-border last:border-0 hover:bg-surface">
                <td className="px-5 py-4">
                  <Link href={`/trade/${market.slug}`} className="flex items-center gap-3 rounded-md">
                    <MarketAvatar initials={market.initials} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground group-hover:text-signal">{market.question}</span>
                      <span className="mt-1 flex items-center gap-1.5">
                        <Badge>{market.providerLabel}</Badge>
                        <Badge tone={lifecycleTone(market)}>{market.lifecycle}</Badge>
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-4 text-right font-mono font-medium text-foreground">{cents(market.mark)}</td>
                <td className={cn("px-3 py-4 text-right font-mono", changeTone(market.stats.change24hCents))}>{centsChange(market.stats.change24hCents)}</td>
                <td className="px-3 py-4 text-right font-mono text-muted"><IndexCell market={market} /></td>
                <td className="px-3 py-4 text-right font-mono text-muted">{usdShort(market.stats.volume24hUsd)}</td>
                <td className="px-3 py-4 text-right font-mono text-muted">{usdShort(market.stats.openInterestUsd)}</td>
                <td className="px-5 py-4 text-right font-mono text-muted">{countdown(market.closeTime)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <ul className="space-y-3 md:hidden">
        {markets.map((market) => (
          <li key={market.slug}>
            <Link href={`/trade/${market.slug}`} className="block rounded-lg border border-border bg-surface p-4 active:bg-surface-2">
              <div className="flex items-start gap-3">
                <MarketAvatar initials={market.initials} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug text-foreground">{market.question}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <Badge>{market.providerLabel}</Badge>
                    <Badge tone={lifecycleTone(market)}>{market.lifecycle}</Badge>
                  </div>
                </div>
                <ChevronRight className="mt-1 size-4 text-subtle" aria-hidden="true" />
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
                <div>
                  <dt className="text-xs text-subtle">Price</dt>
                  <dd className="mt-0.5 font-mono text-sm text-foreground">{cents(market.mark)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-subtle">24h</dt>
                  <dd className={cn("mt-0.5 font-mono text-sm", changeTone(market.stats.change24hCents))}>{centsChange(market.stats.change24hCents)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-subtle">Closes in</dt>
                  <dd className="mt-0.5 font-mono text-sm text-muted">{countdown(market.closeTime)}</dd>
                </div>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
