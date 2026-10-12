import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ArrowDown } from "lucide-react";
import { Callout, DocHeader, H2, H3, NextLink, P, Strong, Table, UL } from "@/components/docs/prose";

export const metadata: Metadata = { title: "How it works" };

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border-strong bg-surface p-4">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted">{children}</p>
    </div>
  );
}

const Down = () => <ArrowDown className="mx-auto my-2 size-4 text-signal" aria-hidden="true" />;

export default function HowItWorksPage() {
  return (
    <>
      <DocHeader
        eyebrow="Concepts"
        title="How it works"
        description="Moxie turns an event on a prediction market into a perpetual contract you can trade continuously, with fully collateralized risk and permissionless upkeep."
      />

      <H2>The big picture</H2>
      <div className="mt-6" role="img" aria-label="Diagram: source market feeds the oracle, which prices the Percolator engine; traders trade against a liquidity provider through the matcher; keepers and the indexer keep it running.">
        <Box title="Source market (Panta)">A yes/no event with its own order book and price, e.g. “Saka 7+ points, GW6”.</Box>
        <Down />
        <Box title="Moxie oracle">An off-chain reporter reads the source price and posts it on-chain, together with the event’s close time and lifecycle schedule.</Box>
        <Down />
        <div className="grid gap-3 sm:grid-cols-2">
          <Box title="Percolator engine">Holds every portfolio’s collateral and positions, enforces margin, charges funding and settles PnL. All USDC sits in one program-owned vault.</Box>
          <Box title="Moxie matcher">Quotes prices for the liquidity provider (LP) around the protected mark. Every trade fills against the LP’s portfolio.</Box>
        </div>
        <Down />
        <div className="grid gap-3 sm:grid-cols-2">
          <Box title="Keepers">Permissionless bots that “crank” the market: bring prices and funding up to date and run the end-of-market steps.</Box>
          <Box title="Indexer">Reads the chain and serves markets, charts, fills and portfolios to the website and the API.</Box>
        </div>
      </div>

      <H2>Three prices</H2>
      <P>Each market has three related prices. They usually sit within a cent or two of each other.</P>
      <Table
        head={["Price", "What it is", "Used for"]}
        rows={[
          ["Source index", "The latest price from the source market, as posted by the oracle.", "Anchoring the mark, and funding."],
          ["Protected mark", "The source index plus a time-averaged premium. It moves gradually, so one sudden quote or trade can’t trigger liquidations. This is the “Price” shown across the site and the main line on the chart.", "Margin, estimated PnL, and closing positions at hard-flat."],
          ["Moxie price", "Where you actually trade: the liquidity provider’s quote around the mark, adjusted for spread, order size and inventory. Order flow moves it.", "Your fill. The order ticket shows it as Est. fill price."],
        ]}
      />
      <Callout tone="note">
        If the source market stops publishing a price, the index shows as <Strong>paused</Strong>. Moxie keeps trading on its own price, and the
        index updates again as soon as the source publishes.
      </Callout>

      <H2>Trading against the liquidity provider</H2>
      <P>
        Moxie has no order book. When you trade, the Percolator engine calls the Moxie matcher, which prices your order for the liquidity provider’s
        portfolio and the trade settles immediately between the two portfolios. The matcher’s price depends on:
      </P>
      <UL>
        <li><Strong>Base spread:</Strong> a small fixed distance from the mark.</li>
        <li><Strong>Size:</Strong> bigger orders get a slightly wider price.</li>
        <li><Strong>Inventory:</Strong> if the LP already holds a lot of one side, prices lean to encourage trades that rebalance it.</li>
        <li><Strong>Limits:</Strong> a maximum size per fill and a maximum total LP position. Orders beyond them are refused, and the ticket asks you to trade smaller.</li>
      </UL>
      <P>Your order carries a limit price, so the transaction fails rather than fill worse than you agreed to.</P>

      <H2>Collateral and margin</H2>
      <P>
        Your portfolio is an on-chain account owned by the Percolator program. It records your USDC collateral, realized PnL, funding paid and
        received, and your position in each market. Before any trade that adds risk, the engine checks that your equity covers the margin of every
        position you hold.
      </P>
      <P>
        Prices can jump to $0 or $1 on news, so margin covers the worst case: a long needs its price plus $0.05 per contract, a short needs $1 minus the
        price plus $0.05 (or the price, if larger). As a result no position can lose more than the collateral behind it.
      </P>

      <H2>Funding</H2>
      <P>
        Funding keeps Moxie anchored to the source market. The gap between the two is measured in absolute price terms and
        averaged over time; longs pay shorts when Moxie is above the source, shorts pay longs when it is below. Payments accrue every slot and are applied
        whenever the market is cranked, so they show up in your portfolio balance without any action from you.
      </P>

      <H2>Keepers and cranks</H2>
      <P>
        Percolator updates markets lazily. A <Strong>crank</Strong> is a transaction that brings a market up to date: it accrues funding, refreshes
        prices and runs any lifecycle step that is due. Anyone can send one, and Moxie runs a keeper that cranks continuously. If a market falls behind,
        trades that add risk wait until it catches up — that’s the “market data is updating” message you may occasionally see.
      </P>

      <H2>Lifecycle and settlement</H2>
      <P>Each market is listed with a schedule tied to the source event’s close time:</P>
      <Table
        head={["Phase", "Default timing", "Effect"]}
        rows={[
          ["Active", "Listing → close − 30 min", "Normal trading."],
          ["Restricted", "Close − 30 min", "The matcher lowers its per-fill and inventory limits."],
          ["Reduce only", "Close − 10 min", "Only trades that reduce a position are accepted."],
          ["Hard-flat", "Close − 1 min", "Keepers close every remaining position at the protected mark."],
          ["Resolved", "After the source resolves", "The market is closed; remaining accounting is finalized."],
        ]}
      />
      <H3>Why close before the outcome?</H3>
      <P>
        A perpetual has no expiry, but the event behind it does. Closing everyone at the protected mark just before the event closes means no one is
        exposed to the final jump to $0 or $1, and the LP and traders settle at a fair, manipulation-resistant price.
      </P>

      <H2>On-chain programs (devnet)</H2>
      <Table
        head={["Program", "Address"]}
        rows={[
          ["Percolator engine", <code key="p" className="break-all font-mono text-xs">9GnPynrGbmQqQw8715neTB6xqeEw7ZcpRTHCT3AEDM4e</code>],
          ["Moxie matcher", <code key="m" className="break-all font-mono text-xs">H6z6Z5KSQtXj7sYvqX7oCwskBuhWvUDDB8KGNqeuNWXS</code>],
          ["Moxie oracle", <code key="o" className="break-all font-mono text-xs">dLAPcvtkqAtYHh6QFogmm8E3ovCeZtoWvtsWJFP8AQ3</code>],
          ["Market group", <code key="g" className="break-all font-mono text-xs">AihBkr17D9hSSyWRLK5cetZC2P5xMVbft112bHjZWgc2</code>],
          ["Test USDC mint", <code key="u" className="break-all font-mono text-xs">5yV4TPjnwvAGTmqJdjeM7rFZUVcrxSfPVVK87YNK3NRS</code>],
        ]}
      />

      <NextLink href="/docs/sdk" title="TypeScript SDK" description="Build Moxie transactions and size orders in your own code." />
    </>
  );
}
