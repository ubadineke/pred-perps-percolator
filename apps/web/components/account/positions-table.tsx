"use client";

import Link from "next/link";
import type { MoxieAccount } from "@/hooks/use-moxie-account";
import type { ApiPosition } from "@/lib/api";
import type { Market } from "@/lib/markets";
import { entryPriceCents, positionPnlUsd } from "@/lib/moxie-client";
import { cents, contracts, qToContracts, usd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge, EmptyState, MarketAvatar } from "../ui/primitives";
import { Button } from "../ui/button";

type Row = { position: ApiPosition; market?: Market };

/** Every open position in the portfolio across markets, with live PnL and a Close action. */
export function PositionsTable({ account, markets, emptyHint }: { account: MoxieAccount; markets: Market[]; emptyHint?: string }) {
  const positions = account.portfolio?.positions ?? [];
  if (!positions.length) {
    return <EmptyState title="No open positions" description={emptyHint ?? "Positions you open appear here, across every market."} />;
  }
  const rows: Row[] = positions.map((position) => ({
    position,
    market: markets.find((m) => m.marketId === position.marketId && m.assetIndex === position.assetIndex),
  }));

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-subtle">
              <th scope="col" className="px-4 py-2.5 font-medium">Market</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Side</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Contracts</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Entry</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Price</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Est. PnL</th>
              <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ position, market }) => {
              const pnl = market ? positionPnlUsd(position, market.mark) : null;
              return (
                <tr key={`${position.marketId}-${position.slot}`} className="border-b border-border last:border-0">
                  <td className="max-w-xs px-4 py-3">
                    {market ? (
                      <Link href={`/trade/${market.slug}`} className="flex items-center gap-2.5 hover:text-signal">
                        <MarketAvatar initials={market.initials} size="sm" />
                        <span className="truncate font-medium">{market.question}</span>
                      </Link>
                    ) : (
                      <span className="text-muted">Market #{position.marketId}</span>
                    )}
                  </td>
                  <td className="px-3 py-3"><Badge tone={position.side === "long" ? "long" : "short"}>{position.side === "long" ? "Long · Yes" : "Short · No"}</Badge></td>
                  <td className="px-3 py-3 text-right font-mono">{contracts(qToContracts(position.sizeQ))}</td>
                  <td className="px-3 py-3 text-right font-mono text-muted">{cents(entryPriceCents(position))}</td>
                  <td className="px-3 py-3 text-right font-mono">{market ? cents(market.mark) : "—"}</td>
                  <td className={cn("px-3 py-3 text-right font-mono", pnl === null ? "text-subtle" : pnl >= 0 ? "text-long" : "text-short")}>{pnl === null ? "—" : `${pnl >= 0 ? "+" : ""}${usd(pnl)}`}</td>
                  <td className="px-4 py-3 text-right">
                    {market ? (
                      <Button size="sm" variant="outline" loading={account.busy === "close"} disabled={account.busy !== null} onClick={() => account.close(market, position)}>
                        Close
                      </Button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-border md:hidden">
        {rows.map(({ position, market }) => {
          const pnl = market ? positionPnlUsd(position, market.mark) : null;
          return (
            <li key={`${position.marketId}-${position.slot}`} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium leading-snug">{market?.question ?? `Market #${position.marketId}`}</p>
                <Badge tone={position.side === "long" ? "long" : "short"}>{position.side === "long" ? "Long" : "Short"}</Badge>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div><dt className="text-xs text-subtle">Contracts</dt><dd className="font-mono">{contracts(qToContracts(position.sizeQ))}</dd></div>
                <div><dt className="text-xs text-subtle">Entry</dt><dd className="font-mono text-muted">{cents(entryPriceCents(position))}</dd></div>
                <div><dt className="text-xs text-subtle">Est. PnL</dt><dd className={cn("font-mono", pnl === null ? "text-subtle" : pnl >= 0 ? "text-long" : "text-short")}>{pnl === null ? "—" : usd(pnl)}</dd></div>
              </dl>
              {market ? (
                <Button size="sm" variant="outline" className="w-full" loading={account.busy === "close"} disabled={account.busy !== null} onClick={() => account.close(market, position)}>
                  Close position
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
