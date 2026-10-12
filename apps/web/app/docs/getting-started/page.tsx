import type { Metadata } from "next";
import Link from "next/link";
import { AnnotatedScreenshot } from "@/components/docs/annotated-screenshot";
import { Callout, DocHeader, NextLink, P, Step, Strong, UL } from "@/components/docs/prose";

export const metadata: Metadata = { title: "Getting started" };

export default function GettingStartedPage() {
  return (
    <>
      <DocHeader
        eyebrow="Using Moxie"
        title="Getting started"
        description="From a fresh wallet to your first trade in about five minutes. Moxie currently runs on Solana devnet, so everything here uses free test funds."
      />

      <Callout tone="tip" title="What you need">
        A Solana browser wallet (Phantom, Solflare or Backpack). That’s it — Moxie gives you the devnet SOL and test USDC you need.
      </Callout>

      <Step number={1} title="Set your wallet to Devnet">
        <P>
          Moxie runs on Solana’s <Strong>devnet</Strong>, a test network where tokens have no real value. Your wallet has to be on the same network, or
          transactions will fail.
        </P>
        <UL>
          <li><Strong>Phantom:</Strong> Settings → Developer Settings → turn on Testnet Mode → choose Solana Devnet.</li>
          <li><Strong>Solflare:</Strong> Settings → Network → Devnet.</li>
          <li><Strong>Backpack:</Strong> Settings → Solana → RPC connection → Devnet.</li>
        </UL>
        <Callout tone="warning">Use a separate wallet (or account) for testing. Don’t use a wallet that holds real funds you care about.</Callout>
      </Step>

      <Step number={2} title="Connect your wallet">
        <P>Open any market from the <Link className="text-foreground underline underline-offset-2" href="/markets">Markets</Link> page. The trading screen looks like this before you connect:</P>
        <AnnotatedScreenshot
          src="/docs/trade-connect.png"
          width={1440}
          height={900}
          alt="The trading screen before a wallet is connected"
          callouts={[
            { target: [1305, 32], marker: [1000, 32], text: <><Strong>Connect</Strong> opens the wallet picker. It’s always in the top-right corner.</> },
            { target: [1263, 300], marker: [1263, 470], text: <>The <Strong>order ticket</Strong> also shows a Connect button, plus a reminder to use Devnet.</> },
            { target: [135, 250], marker: [135, 420], text: <>The <Strong>market list</Strong>. Click any market to switch to it.</> },
            { target: [650, 185], marker: [650, 330], text: <><Strong>Market stats</Strong>: the current price, its 24-hour change, the source market’s price, volume, open interest and time until the event closes.</> },
            { target: [650, 452], marker: [480, 540], text: <>The <Strong>price chart</Strong>. The blue line is the market’s price (its protected mark); the dashed line is the source index.</> },
          ]}
        />
        <P>Pick your wallet in the dialog and approve the connection. Your shortened address replaces the Connect button when you’re connected.</P>
      </Step>

      <Step number={3} title="Create your portfolio">
        <P>
          Your <Strong>portfolio</Strong> is your trading account on Moxie. It holds your collateral and every position you open, across all markets. You
          create it once.
        </P>
        <AnnotatedScreenshot
          src="/docs/ticket-create.png"
          width={500}
          height={470}
          maxWidth={420}
          alt="Order ticket asking you to create a portfolio"
          callouts={[
            { target: [412, 334], marker: [468, 298], text: <>Creating a portfolio costs about <Strong>0.07 SOL</Strong> of refundable account rent. If your wallet has less than that, click <Strong>Get 0.1 devnet SOL</Strong> first.</> },
            { target: [250, 412], marker: [250, 452], text: <>Then click <Strong>Create portfolio</Strong> and approve it in your wallet. It appears within a few seconds.</> },
          ]}
        />
      </Step>

      <Step number={4} title="Add collateral">
        <P>Positions are backed by USDC collateral in your portfolio. On devnet, Moxie hands out free test USDC.</P>
        <AnnotatedScreenshot
          src="/docs/ticket-fund.png"
          width={500}
          height={510}
          maxWidth={420}
          alt="Order ticket asking you to fund your portfolio"
          callouts={[
            { target: [250, 442], marker: [250, 490], text: <><Strong>Get 1,000 test USDC</Strong> sends test USDC to your wallet (no approval needed).</> },
            { target: [85, 280], marker: [36, 280], text: <>Type how much to deposit, or use <Strong>50%</Strong> / <Strong>Max</Strong>. The right-hand label shows your wallet balance.</> },
            { target: [85, 379], marker: [36, 379], text: <><Strong>Deposit USDC</Strong> moves it into your portfolio. Approve it in your wallet.</> },
          ]}
        />
        <Callout tone="note">Collateral is shared: one deposit backs positions in every market. You can add or withdraw more later from the order ticket’s Collateral section or the Portfolio page.</Callout>
      </Step>

      <Step number={5} title="Place a trade">
        <P>
          Contracts trade between <Strong>$0 and $1</Strong>, and the price follows how likely the source market thinks the event is. Go <Strong>long</Strong> if
          you expect the price to rise, <Strong>short</Strong> if you expect it to fall.
        </P>
        <AnnotatedScreenshot
          src="/docs/terminal-trading.png"
          width={1440}
          height={900}
          alt="The trading screen with a funded portfolio and two open positions"
          callouts={[
            { target: [1112, 106], marker: [1040, 106], text: <>Choose <Strong>Long · Yes</Strong> or <Strong>Short · No</Strong>.</> },
            { target: [1110, 190], marker: [1040, 190], text: <>Enter the <Strong>amount</Strong> of collateral to use, or pick 25% / 50% / 75% / Max of your free collateral.</> },
            { target: [1110, 360], marker: [995, 330], text: <>Check the <Strong>summary</Strong>: number of contracts, estimated fill price, margin used, the 0.3% fee, and what the position would be worth if the price reached $1 (or $0 for a short).</> },
            { target: [1110, 491], marker: [995, 520], text: <>Click <Strong>Buy Yes · Long</Strong> (or <Strong>Buy No · Short</Strong>) and approve in your wallet. The order is price-protected: it fails rather than fill more than $0.02 per contract worse than the quote.</> },
            { target: [1110, 610], marker: [995, 610], text: <><Strong>Collateral</Strong> expands to deposit or withdraw without leaving the screen.</> },
            { target: [360, 245], marker: [360, 330], text: <>Change the chart’s <Strong>time range</Strong>, or switch to candles. Your own fills show up as labelled arrows.</> },
          ]}
        />
        <Callout tone="tip" title="How sizing works">
          Moxie sizes your order so its margin plus fee fit inside the amount you enter, so an order never fails for lack of collateral. A contract at
          $0.49 needs $0.54 of margin ($0.49 plus a $0.05 buffer), so 100 contracts need about $54 and would be worth $100 if the price reached $1.
        </Callout>
      </Step>

      <Step number={6} title="Manage and close positions">
        <P>Open positions appear under the chart on the trading screen, and on the Portfolio page.</P>
        <AnnotatedScreenshot
          src="/docs/terminal-trading.png"
          width={1440}
          height={900}
          alt="Open positions under the chart"
          callouts={[
            { target: [330, 682], marker: [200, 770], text: <>The <Strong>Positions</Strong> tab lists every open position across all markets. <Strong>Market fills</Strong> shows recent trades in this market.</> },
            { target: [960, 755], marker: [960, 870], text: <><Strong>Est. PnL</Strong> is your profit or loss at the current price.</> },
            { target: [1072, 755], marker: [1250, 755], text: <><Strong>Close</Strong> exits the whole position at the current price, with the same $0.02 price protection.</> },
          ]}
        />
      </Step>

      <Step number={7} title="Check your portfolio and withdraw">
        <P>The <Link className="text-foreground underline underline-offset-2" href="/portfolio">Portfolio</Link> page shows your whole account.</P>
        <AnnotatedScreenshot
          src="/docs/portfolio.png"
          width={1440}
          height={1000}
          alt="The portfolio page with two positions"
          callouts={[
            { target: [135, 378], marker: [55, 378], text: <><Strong>Equity</Strong> (deposits plus profit and loss), <Strong>free collateral</Strong> (what you can trade with or withdraw), margin in use and unrealized PnL.</> },
            { target: [140, 443], marker: [55, 443], text: <>The bar shows how much of your equity is committed as margin. Blue is comfortable; amber and red mean you’re close to your limit.</> },
            { target: [895, 625], marker: [700, 780], text: <>Close any position from here too.</> },
            { target: [1308, 646], marker: [1385, 646], text: <>Switch between <Strong>Deposit</Strong> and <Strong>Withdraw</Strong>.</> },
            { target: [1308, 826], marker: [1385, 826], text: <>Enter an amount and confirm. You can withdraw any collateral that isn’t backing open positions.</> },
            { target: [1328, 976], marker: [1385, 976], text: <><Strong>Health</Strong> tells you whether your collateral covers your positions.</> },
          ]}
        />
      </Step>

      <NextLink href="/docs/trading" title="Trading guide" description="Prices, margin, settlement and every field in the order ticket." />
    </>
  );
}
