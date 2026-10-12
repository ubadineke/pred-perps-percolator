import type { Metadata } from "next";
import Link from "next/link";
import { AnnotatedScreenshot } from "@/components/docs/annotated-screenshot";
import { Callout, DocHeader, H2, NextLink, P, Strong, UL } from "@/components/docs/prose";

export const metadata: Metadata = { title: "Docs" };

const guides = [
  { href: "/docs/getting-started", title: "Getting started", text: "Wallet to first trade, step by step with screenshots." },
  { href: "/docs/trading", title: "Trading guide", text: "Prices, margin, fees, and what happens when an event closes." },
  { href: "/docs/how-it-works", title: "How it works", text: "Source markets, the three prices, funding, keepers and settlement." },
  { href: "/docs/troubleshooting", title: "Troubleshooting", text: "What each error message means and how to fix it." },
  { href: "/docs/sdk", title: "TypeScript SDK", text: "Build transactions, size orders and decode accounts in code." },
  { href: "/docs/api", title: "Indexer API", text: "Read markets, prices, fills and portfolios over HTTP." },
];

export default function DocsOverviewPage() {
  return (
    <>
      <DocHeader
        eyebrow="Documentation"
        title="Moxie docs"
        description="Moxie turns real-world yes/no events into perpetual contracts on Solana: go long or short as the outlook changes, add to or trim your position at any time, and exit before the event closes."
      />

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {guides.map((guide) => (
          <Link key={guide.href} href={guide.href} className="rounded-lg border border-border p-5 transition-colors hover:border-border-strong hover:bg-surface">
            <span className="block font-semibold text-foreground">{guide.title}</span>
            <span className="mt-1 block text-sm text-muted">{guide.text}</span>
          </Link>
        ))}
      </div>

      <H2>Moxie in one minute</H2>
      <UL>
        <li>Every market tracks a <Strong>yes/no event</Strong> listed on a source prediction market (currently Panta), such as “Saka scores 7+ FPL points in Gameweek 6”.</li>
        <li>Each contract trades between <Strong>$0 and $1</Strong>. Its price follows the source market, so it rises as the event looks more likely and falls as it looks less likely.</li>
        <li>Go <Strong>long</Strong> to gain when the price rises, <Strong>short</Strong> to gain when it falls. Your profit or loss is the price change times your number of contracts.</li>
        <li>Positions are backed by USDC <Strong>collateral</Strong> in your Moxie portfolio. One deposit covers every market.</li>
        <li>Trading stops shortly before the event closes; any position still open is closed automatically at the market’s protected price.</li>
      </UL>

      <Callout tone="warning" title="Devnet only">
        Moxie currently runs on Solana devnet with test USDC. Nothing on it has real value, and markets, balances and positions may be reset.
      </Callout>

      <H2>The markets page</H2>
      <P>Everything starts from the markets list.</P>
      <AnnotatedScreenshot
        src="/docs/markets.png"
        width={1440}
        height={900}
        alt="The markets page"
        callouts={[
          { target: [120, 452], marker: [55, 452], text: <>Each row is a market. Click it to open the trading screen.</> },
          { target: [745, 445], marker: [790, 320], text: <>The current contract <Strong>price</Strong> and how much it moved in the last 24 hours.</> },
          { target: [1310, 452], marker: [1385, 452], text: <>Time until the source event <Strong>closes</Strong>. Trading winds down before this (see <Link className="text-foreground underline underline-offset-2" href="/docs/trading#before-an-event-closes">Trading guide</Link>).</> },
          { target: [112, 750], marker: [55, 750], text: <><Strong>Source markets</Strong> lists events on the source prediction market that Moxie can list next.</> },
        ]}
      />

      <NextLink href="/docs/getting-started" title="Getting started" description="Set up a wallet and place your first trade." />
    </>
  );
}
