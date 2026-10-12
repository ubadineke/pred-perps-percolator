import type { Metadata } from "next";
import Link from "next/link";
import { Callout, DocHeader, H2, H3, NextLink, P, Strong, Table, UL } from "@/components/docs/prose";

export const metadata: Metadata = { title: "Trading guide" };

export default function TradingGuidePage() {
  return (
    <>
      <DocHeader
        eyebrow="Using Moxie"
        title="Trading guide"
        description="What the numbers on the trading screen mean, how margin and fees are worked out, and what happens to your position as an event approaches."
      />

      <H2>Prices</H2>
      <P>
        Each market follows one yes/no event. Its contracts trade between <Strong>$0 and $1</Strong>, and the price follows the source market: it rises as
        the event looks more likely and falls as it looks less likely. A contract priced at $0.62 is worth $0.62; your profit or loss is the change in
        price times the number of contracts you hold.
      </P>
      <Table
        head={["You think…", "Do this", "You gain when"]}
        rows={[
          ["The event will look more likely over time", <Strong key="l">Long · Yes</Strong>, "The price rises"],
          ["The event will look less likely over time", <Strong key="s">Short · No</Strong>, "The price falls"],
        ]}
      />
      <P>
        Moxie is a <Strong>perpetual</Strong>: there are no fixed expiries or order books to manage. You can open, add to, reduce or close a position
        whenever the market is open, and your profit or loss follows the price continuously.
      </P>

      <H2>Margin</H2>
      <P>
        Prices can jump straight to $0 or $1 on news, so Moxie requires <Strong>full collateral</Strong> for the most a position could lose,
        plus a $0.05 safety buffer per contract.
      </P>
      <Table
        head={["Side", "Margin per contract", "Example at $0.40"]}
        rows={[
          ["Long", "Price + $0.05", "$0.45 per contract"],
          ["Short", "The larger of ($1 − price + $0.05) and the price", "$0.65 per contract"],
        ]}
      />
      <P>
        Because positions are fully collateralized, a price move can’t push your account below zero. Margin is released back to <Strong>free
        collateral</Strong> when you close.
      </P>

      <H2>Fees and price protection</H2>
      <UL>
        <li><Strong>Trading fee:</Strong> 0.3% of the position’s value (contracts × price), charged on each open and close. 100 contracts at $0.50 pay $0.15.</li>
        <li><Strong>Spread:</Strong> the liquidity provider buys slightly below and sells slightly above the market price. The order ticket’s <Strong>Est. fill price</Strong> already includes it.</li>
        <li><Strong>Price protection:</Strong> every order carries a limit $0.02 per contract worse than the quote. If the market moves more than that before your transaction lands, it fails and nothing is charged except the network fee.</li>
        <li><Strong>Network fees:</Strong> a fraction of a cent of SOL per transaction.</li>
      </UL>

      <H2>The order ticket</H2>
      <Table
        head={["Field", "Meaning"]}
        rows={[
          ["Amount", "How much free collateral to commit, margin and fee included. Moxie works out the number of contracts from it."],
          ["Contracts", "The position size. Each contract is worth up to $1."],
          ["Est. fill price", "Your expected fill price, including the liquidity provider’s spread."],
          ["Margin", "Collateral locked while the position is open."],
          ["Fee", "The 0.3% trading fee."],
          ["Value at $1.00 / $0.00", "What the position would be worth if the price went all the way in your favour: $1 per contract. Positions are closed at the mark before the event ends, so this is a ceiling, not a payout."],
        ]}
      />
      <Callout tone="tip">
        The <Strong>Collateral</Strong> section under the ticket deposits or withdraws USDC without leaving the trading screen. On devnet it also has a
        button for free test USDC.
      </Callout>

      <H2>Funding</H2>
      <P>
        Moxie’s price is kept close to the source market by <Strong>funding</Strong>. When Moxie trades above the source, longs pay shorts; when it
        trades below, shorts pay longs. Payments are small, accrue continuously and settle straight into your portfolio balance — you don’t need to do
        anything. See <Link className="text-foreground underline underline-offset-2" href="/docs/how-it-works#funding">How it works</Link> for the details.
      </P>

      <H2>Before an event closes</H2>
      <P>Every market follows a fixed schedule leading up to the source event’s close time. The status badge on the trading screen shows the current phase.</P>
      <Table
        head={["Phase", "When", "What you can do"]}
        rows={[
          ["Active", "Until 30 min before close", "Everything: open, add, reduce, close."],
          ["Restricted", "30 min before close", "Trading continues, but the liquidity provider takes smaller orders."],
          ["Reduce only", "10 min before close", "Only orders that shrink a position. Close or trim; you can’t open or add."],
          ["Hard-flat", "1 min before close", "Trading stops. Any position still open is closed automatically at the protected mark."],
          ["Resolved", "After close", "The market is finished. Your collateral and settled PnL stay in your portfolio."],
        ]}
      />
      <Callout tone="warning" title="Hard-flat is not a $1 payout">
        Moxie closes open positions at the market’s <Strong>protected mark</Strong> just before the event closes — it does not wait for the event’s
        outcome and pay $1 or $0. If you want a particular exit price, close yourself before the market turns reduce-only.
      </Callout>

      <H3>Positions in several markets</H3>
      <P>
        One portfolio holds positions in every market, all backed by the same collateral. Each position settles on its own schedule as its event
        approaches.
      </P>

      <NextLink href="/docs/how-it-works" title="How it works" description="Source markets, the three prices, funding, keepers and settlement." />
    </>
  );
}
