"use client";

import type { Market } from "@/lib/markets";
import type { ExecutionConfig } from "@/lib/moxie-client";
import { PortfolioView } from "../account/portfolio-view";
import { MarketInfo } from "../trade/market-info";
import { OrderTicket } from "../trade/order-ticket";
import { TradeTerminal } from "../trade/trade-terminal";
import { MarketExplorer } from "../market-explorer";
import { Container, PageHeader } from "../ui/primitives";
import { sampleAccount } from "./sample-account";

export type CaptureShot = "ticket-create" | "ticket-fund" | "terminal-trading" | "portfolio" | "market-info" | "markets";

/** Renders one documentation screenshot with sample account data. Used only by /capture. */
export function CaptureView({ shot, market, markets, config }: { shot: CaptureShot; market: Market; markets: Market[]; config: ExecutionConfig }) {
  if (shot === "ticket-create" || shot === "ticket-fund") {
    return (
      <div className="flex w-[500px] justify-center bg-background p-6">
        <div className="w-[360px]">
          <OrderTicket market={market} account={sampleAccount(shot === "ticket-create" ? "create" : "fund", markets)} config={config} matcherData={null} />
        </div>
      </div>
    );
  }
  if (shot === "markets") {
    return (
      <Container className="pb-16">
        <PageHeader eyebrow="Markets" title="What’s your call?" description="Go long or short on real-world events, and exit whenever you like." />
        <MarketExplorer markets={markets} />
      </Container>
    );
  }
  if (shot === "market-info") {
    return (
      <div className="mx-auto max-w-4xl border-x border-border">
        <MarketInfo market={market} cluster={config.cluster} />
      </div>
    );
  }
  if (shot === "terminal-trading") {
    return <TradeTerminal market={market} markets={markets} config={config} accountOverride={sampleAccount("trading", markets)} initialAmount="100" />;
  }
  return (
    <Container className="pb-16">
      <PageHeader eyebrow="Portfolio" title="Your account" description="One collateral balance backs every position, across every market." />
      <PortfolioView config={config} markets={markets} accountOverride={sampleAccount("trading", markets)} />
    </Container>
  );
}
