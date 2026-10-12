import type { Metadata } from "next";
import { Callout, DocHeader, H2, NextLink, P, Strong, Table } from "@/components/docs/prose";

export const metadata: Metadata = { title: "Troubleshooting" };

export default function TroubleshootingPage() {
  return (
    <>
      <DocHeader
        eyebrow="Using Moxie"
        title="Troubleshooting"
        description="What Moxie’s messages mean and what to do about them. If you cancel a transaction in your wallet, Moxie shows nothing — nothing was sent."
      />

      <H2>Wallet and setup</H2>
      <Table
        head={["Problem", "What to do"]}
        rows={[
          ["Transactions fail straight away, or balances look wrong", "Your wallet is probably on Mainnet. Switch it to Devnet (see Getting started, step 1) and reload."],
          ["“Your wallet needs a little more SOL to cover account rent”", "Creating a portfolio needs about 0.07 SOL. Use Get 0.1 devnet SOL in the order ticket, or a public devnet faucet."],
          ["“Your wallet doesn’t have enough SOL for network fees”", "Every transaction needs a tiny amount of SOL. Use the devnet SOL button (available while your balance is under 0.05 SOL, once an hour)."],
          ["“Not enough USDC in your wallet for this deposit”", "Click Get 1,000 test USDC, then deposit again."],
          ["Faucet says to wait", "The test USDC faucet allows one request every few seconds; the SOL faucet once an hour per wallet."],
          ["My portfolio doesn’t appear after creating it", "It usually shows within a few seconds. If not, reload the page — the transaction may have confirmed while the page was waiting."],
        ]}
      />

      <H2>Trading</H2>
      <Table
        head={["Message", "Meaning and fix"]}
        rows={[
          ["“Not enough free collateral for this order”", "The order’s margin plus fee is more than your free collateral. Lower the amount or deposit more."],
          ["“The liquidity provider can’t fill this order right now” / “larger than the liquidity provider can fill”", "The order is over the LP’s per-fill or inventory limit. Trade a smaller size, or split it into several orders."],
          ["“Market data is updating. Retry in a few seconds.”", "The market needs a crank before it accepts trades that add risk. The keeper does this automatically; wait a moment and retry."],
          ["“Nothing to update yet”", "A crank was sent when the market was already current. Harmless; retry your action."],
          ["“This market changed since the page loaded”", "The market was re-listed or reset. Reload the page."],
          ["“Your portfolio can’t open a position in another market right now”", "Your portfolio has reached its limit of open markets. Close a position in another market first."],
          ["“This market is in recovery mode”", "Trading is paused by the engine while it recovers. Try again later."],
          ["The transaction failed with a price error", "The price moved more than $0.02 before your order landed. Check the new price and resubmit."],
          ["I can’t open a new position, only close", "The market is in Reduce-only, close to the event. See the Trading guide."],
        ]}
      />

      <H2>Withdrawals</H2>
      <Table
        head={["Message", "Meaning and fix"]}
        rows={[
          ["“That amount is still backing your open positions”", "You can only withdraw free collateral. Withdraw less, or close a position first."],
          ["“The network took too long to confirm”", "Check your wallet’s activity before retrying — the first transaction may have gone through."],
        ]}
      />

      <H2>Data looks stale</H2>
      <P>
        The website reads prices and positions from Moxie’s indexer. If the chart stops moving or a new position doesn’t appear, reload the page. The
        source index may show <Strong>paused</Strong> when the source market isn’t publishing a price; that doesn’t stop trading.
      </P>

      <Callout tone="note" title="Still stuck?">
        Copy the transaction signature from your wallet and open it in a devnet explorer such as Solana Explorer (cluster: devnet). The program logs
        show exactly which check failed.
      </Callout>

      <NextLink href="/docs/sdk" title="TypeScript SDK" description="Build Moxie transactions and size orders in your own code." />
    </>
  );
}
