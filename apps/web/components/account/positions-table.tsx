"use client";

import { Share2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { MoxieAccount } from "@/hooks/use-moxie-account";
import type { ApiPosition } from "@/lib/api";
import type { Market } from "@/lib/markets";
import { entryPriceCents, positionPnlUsd } from "@/lib/moxie-client";
import { price, contracts, qToContracts, usd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge, EmptyState, MarketAvatar } from "../ui/primitives";
import { Button } from "../ui/button";
import { ShareDialog } from "./share-dialog";
import type { ShareCard } from "@/lib/share-card";

type Row = { position: ApiPosition; market?: Market };
type CardData = Omit<ShareCard, "design" | "handle">;

/** Card data for a position valued at `exitCents`; null without an entry price. */
function cardFor(position: ApiPosition, market: Market, exitCents: number, status: CardData["status"]): CardData | null {
  const entryCents = entryPriceCents(position);
  if (entryCents === null) return null;
  return { market: market.question, side: position.side, contracts: Math.abs(qToContracts(position.sizeQ)), entryCents, exitCents, status };
}

/** Every open position in the portfolio across markets, with live PnL, Share and Close actions. */
export function PositionsTable({ account, markets, emptyHint }: { account: MoxieAccount; markets: Market[]; emptyHint?: string }) {
  const [sharing, setSharing] = useState<CardData | null>(null);
  const positions = account.portfolio?.positions ?? [];
  const dialog = sharing ? <ShareDialog card={sharing} onClose={() => setSharing(null)} /> : null;
  if (!positions.length) {
    return (
      <>
        <EmptyState title="No open positions" description={emptyHint ?? "Positions you open appear here, across every market."} />
        {dialog}
      </>
    );
  }
  // After a successful close, offer the realized result as a card.
  const closeAndOffer = async (market: Market, position: ApiPosition) => {
    const fillCents = await account.close(market, position);
    const card = fillCents === null ? null : cardFor(position, market, fillCents, "closed");
    if (card) setSharing(card);
  };
  const shareOpen = (market: Market, position: ApiPosition) => {
    const card = cardFor(position, market, market.mark, "open");
    if (card) setSharing(card);
  };
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
                  <td className="px-3 py-3 text-right font-mono text-muted">{price(entryPriceCents(position))}</td>
                  <td className="px-3 py-3 text-right font-mono">{market ? price(market.mark) : "—"}</td>
                  <td className={cn("px-3 py-3 text-right font-mono", pnl === null ? "text-subtle" : pnl >= 0 ? "text-long" : "text-short")}>{pnl === null ? "—" : `${pnl >= 0 ? "+" : ""}${usd(pnl)}`}</td>
                  <td className="px-4 py-3 text-right">
                    {market ? (
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="ghost" aria-label="Share this position" disabled={entryPriceCents(position) === null} onClick={() => shareOpen(market, position)}>
                          <Share2 className="size-4" aria-hidden="true" />
                        </Button>
                        <Button size="sm" variant="outline" loading={account.busy === "close"} disabled={account.busy !== null} onClick={() => closeAndOffer(market, position)}>
                          Close
                        </Button>
                      </div>
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
                <div><dt className="text-xs text-subtle">Entry</dt><dd className="font-mono text-muted">{price(entryPriceCents(position))}</dd></div>
                <div><dt className="text-xs text-subtle">Est. PnL</dt><dd className={cn("font-mono", pnl === null ? "text-subtle" : pnl >= 0 ? "text-long" : "text-short")}>{pnl === null ? "—" : usd(pnl)}</dd></div>
              </dl>
              {market ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" disabled={entryPriceCents(position) === null} onClick={() => shareOpen(market, position)}>
                    <Share2 className="size-4" aria-hidden="true" />
                    Share
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" loading={account.busy === "close"} disabled={account.busy !== null} onClick={() => closeAndOffer(market, position)}>
                    Close position
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {dialog}
    </>
  );
}
