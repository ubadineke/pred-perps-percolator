import type { Metadata } from "next";
import { Callout, Code, CodeBlock, DocHeader, H2, H3, NextLink, P, Strong, Table, UL } from "@/components/docs/prose";

export const metadata: Metadata = { title: "TypeScript SDK" };

export default function SdkPage() {
  return (
    <>
      <DocHeader
        eyebrow="Developers"
        title="TypeScript SDK"
        description="@moxie/sdk builds Moxie instructions, sizes orders, replicates the matcher’s quote and decodes on-chain accounts. It has no runtime dependencies and works with any Solana client library."
      />

      <H2>Install</H2>
      <P>
        The SDK lives in the Moxie monorepo at <Code>packages/sdk</Code> and isn’t published to npm yet. Inside the workspace, add it as a dependency:
      </P>
      <CodeBlock title="package.json">{`
"dependencies": {
  "@moxie/sdk": "workspace:*",
  "@solana/web3.js": "^1.98.0"
}
`}</CodeBlock>
      <Table
        head={["Entry point", "Contents"]}
        rows={[
          [<Code key="t">@moxie/sdk/trading</Code>, "Order sizing, margin, matcher quotes and price limits."],
          [<Code key="i">@moxie/sdk/instructions</Code>, "Complete instructions (accounts + data) for portfolio, deposit, withdraw, trade and crank."],
          [<Code key="a">@moxie/sdk/accounts</Code>, "Decoders for imported-market records and portfolios."],
          [<Code key="p">@moxie/sdk/percolator</Code>, "Raw instruction-data encoders for the Percolator engine."],
          [<Code key="m">@moxie/sdk/imported-market</Code>, "Oracle encoders for listing, pricing and resolving markets (operator use; Node only)."],
          [<Code key="r">@moxie/sdk</Code>, "Everything above. Pulls in node:crypto, so prefer the subpaths in browser code."],
        ]}
      />
      <Callout tone="note">
        All protocol amounts are integer <Code>bigint</Code>s: USDC in 6-decimal atoms (<Code>1_000_000n</Code> = $1), prices in E6
        (<Code>500_000n</Code> = $0.50), sizes in q units (<Code>1_000_000n</Code> = 1 contract; positive = long, negative = short).
      </Callout>

      <H2>Addresses you need</H2>
      <P>Instructions take addresses as base58 strings. On devnet:</P>
      <CodeBlock title="config.ts">{`
export const MOXIE = {
  program: "9GnPynrGbmQqQw8715neTB6xqeEw7ZcpRTHCT3AEDM4e",        // Percolator engine
  matcherProgram: "H6z6Z5KSQtXj7sYvqX7oCwskBuhWvUDDB8KGNqeuNWXS",
  market: "AihBkr17D9hSSyWRLK5cetZC2P5xMVbft112bHjZWgc2",         // market group
  usdcMint: "5yV4TPjnwvAGTmqJdjeM7rFZUVcrxSfPVVK87YNK3NRS",       // test USDC
  // Deployment-specific: collateral vault, LP portfolio, matcher context
  // and matcher delegate. Take them from the deployment's .env
  // (MOXIE_COLLATERAL_VAULT, MOXIE_LP_PORTFOLIO, MOXIE_MATCHER_CONTEXT,
  // MOXIE_MATCHER_DELEGATE).
  api: "http://localhost:8787",                                   // indexer
};
`}</CodeBlock>

      <H2>Converting instructions</H2>
      <P>
        Builders return a library-neutral <Code>MoxieInstruction</Code> (<Code>programAddress</Code>, <Code>accounts</Code>, <Code>data</Code>). With
        @solana/web3.js:
      </P>
      <CodeBlock title="to-web3.ts">{`
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import type { MoxieInstruction } from "@moxie/sdk/instructions";

export const toWeb3 = (ix: MoxieInstruction) =>
  new TransactionInstruction({
    programId: new PublicKey(ix.programAddress),
    keys: ix.accounts.map((a) => ({ pubkey: new PublicKey(a.address), isSigner: a.isSigner, isWritable: a.isWritable })),
    data: Buffer.from(ix.data),
  });
`}</CodeBlock>

      <H2>Create a portfolio</H2>
      <P>
        A portfolio is a 9,563-byte account owned by the engine. Allocate it with the System Program in the same transaction, then initialize it. The new
        account’s keypair must sign.
      </P>
      <CodeBlock title="create-portfolio.ts">{`
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { createPortfolioInstruction } from "@moxie/sdk/instructions";

const PORTFOLIO_SIZE = 9563;
const portfolio = Keypair.generate();
const rent = await connection.getMinimumBalanceForRentExemption(PORTFOLIO_SIZE); // ~0.07 SOL

const tx = new Transaction().add(
  SystemProgram.createAccount({
    fromPubkey: owner.publicKey,
    newAccountPubkey: portfolio.publicKey,
    lamports: rent,
    space: PORTFOLIO_SIZE,
    programId: new PublicKey(MOXIE.program),
  }),
  toWeb3(createPortfolioInstruction({
    program: MOXIE.program,
    owner: owner.publicKey.toBase58(),
    market: MOXIE.market,
    portfolio: portfolio.publicKey.toBase58(),
  })),
);
await sendAndConfirmTransaction(connection, tx, [owner, portfolio]);
`}</CodeBlock>

      <H2>Deposit and withdraw</H2>
      <P>
        Both need the portfolio’s current <Code>portfolioId</Code> and <Code>sequence</Code>, which you can read from the indexer
        (<Code>GET /v1/portfolios/:address</Code>) or decode yourself with <Code>decodePortfolioSummary</Code>.
      </P>
      <CodeBlock title="deposit.ts">{`
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { depositInstruction } from "@moxie/sdk/instructions";

const p = await fetch(\`\${MOXIE.api}/v1/portfolios/\${portfolioAddress}\`).then((r) => r.json());

const ix = depositInstruction({
  program: MOXIE.program,
  owner: owner.publicKey.toBase58(),
  market: MOXIE.market,
  portfolio: portfolioAddress,
  sourceToken: getAssociatedTokenAddressSync(new PublicKey(MOXIE.usdcMint), owner.publicKey).toBase58(),
  vault: COLLATERAL_VAULT,
  tokenProgram: TOKEN_PROGRAM_ID.toBase58(),
  portfolioId: BigInt(p.portfolioId),
  sequence: BigInt(p.sequence),
  amount: 100_000_000n, // 100 USDC
});
`}</CodeBlock>
      <P>
        <Code>withdrawInstruction</Code> takes the same fields plus <Code>destinationToken</Code> and <Code>vaultAuthority</Code>, the PDA
        <Code>{`["vault", market]`}</Code> under the engine program:
      </P>
      <CodeBlock>{`
const [vaultAuthority] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault"), new PublicKey(MOXIE.market).toBytes()],
  new PublicKey(MOXIE.program),
);
`}</CodeBlock>

      <H2>Place a trade</H2>
      <P>A trade is four steps: size the order, quote it against the matcher, set a limit, and send.</P>
      <CodeBlock title="trade.ts">{`
import { planOrder, quoteMatcher, limitFor, FEE_BPS, MatcherCapacityError } from "@moxie/sdk/trading";
import { tradeInstruction } from "@moxie/sdk/instructions";

// 1. Market, trader and LP state from the indexer.
const market = await fetch(\`\${MOXIE.api}/v1/markets/\${marketAddress}\`).then((r) => r.json());
const trader = await fetch(\`\${MOXIE.api}/v1/portfolios/\${portfolioAddress}\`).then((r) => r.json());
const lp = await fetch(\`\${MOXIE.api}/v1/portfolios/\${LP_PORTFOLIO}\`).then((r) => r.json());

// 2. Size: spend up to $50 of free collateral going long at the current price.
const markE6 = BigInt(market.markE6);
const plan = planOrder("long", 50, Number(markE6) / 10_000);
if (!plan) throw new Error("Nothing to trade");

// 3. Quote exactly as the on-chain matcher will, then allow $0.02 of slippage.
const ctx = await connection.getAccountInfo(new PublicKey(MATCHER_CONTEXT));
let quote: bigint;
try {
  quote = quoteMatcher(ctx!.data, markE6, plan.sizeQ);
} catch (e) {
  if (e instanceof MatcherCapacityError) throw new Error("Too large for the LP right now; trade smaller.");
  throw e;
}

// 4. Build and send.
const ix = tradeInstruction({
  program: MOXIE.program,
  traderAuthority: owner.publicKey.toBase58(),
  market: MOXIE.market,
  traderPortfolio: portfolioAddress,
  lpPortfolio: LP_PORTFOLIO,
  matcherProgram: MOXIE.matcherProgram,
  matcherContext: MATCHER_CONTEXT,
  matcherDelegate: MATCHER_DELEGATE,
  traderPortfolioId: BigInt(trader.portfolioId),
  traderPositionEpoch: BigInt(trader.positionEpoch),
  lpPortfolioId: BigInt(lp.portfolioId),
  lpPositionEpoch: BigInt(lp.positionEpoch),
  lpMatcherSequence: BigInt(lp.sequence),
  assetIndex: market.assetIndex,
  marketId: BigInt(market.marketId),
  sizeQ: plan.sizeQ,
  feeBps: FEE_BPS,
  limitPriceE6: limitFor(quote, plan.sizeQ),
});

const tx = new Transaction().add(
  ComputeBudgetProgram.requestHeapFrame({ bytes: 128 * 1024 }),
  ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
  toWeb3(ix),
);
await sendAndConfirmTransaction(connection, tx, [owner]);
`}</CodeBlock>
      <H3>Closing a position</H3>
      <P>
        Closing is a trade of the opposite size. Positions decoded with <Code>decodePortfolioSummary</Code> carry a signed <Code>sizeQ</Code>, so pass{" "}
        <Code>-position.sizeQ</Code> as the trade size and quote it the same way.
      </P>
      <Callout tone="tip">
        Trades and withdrawals are compute-heavy; request the larger heap frame and the maximum compute budget as above. If a trade fails with <Code>EngineStale</Code> or{" "}
        <Code>OracleStale</Code>, the market needs a crank first (below).
      </Callout>

      <H2>Order sizing and margin</H2>
      <Table
        head={["Function", "What it does"]}
        rows={[
          [<Code key="1">planOrder(side, amountUsd, priceCents, leverage?)</Code>, "Largest order whose margin + fee fits in amountUsd. Returns contracts, signed sizeQ, notional, margin, fee and maxPayoutUsd, or null."],
          [<Code key="2">marginPerContract(side, price, leverage?)</Code>, "Initial margin per contract at price (0–1): long = price + 0.05; short = max(1 − price + 0.05, price)."],
          [<Code key="3">quoteMatcher(ctx, oracleE6, sizeQ)</Code>, "The matcher’s fill price in E6 for this size, from the 320-byte matcher context. Throws MatcherCapacityError over the fill or inventory limit."],
          [<Code key="4">limitFor(quoteE6, sizeQ, slippageE6?)</Code>, "Limit price: the quote moved $0.02 (SLIPPAGE_E6) against the trader, clamped to (0, 1)."],
          [<Code key="5">FEE_BPS, BINARY_RISK_BUFFER, SLIPPAGE_E6</Code>, "30 bps, 0.05, 20,000 E6."],
        ]}
      />

      <H2>Decoding accounts</H2>
      <CodeBlock title="read-portfolio.ts">{`
import { decodePortfolioSummary, decodeImportedMarket, marketLifecycle } from "@moxie/sdk/accounts";

const info = await connection.getAccountInfo(new PublicKey(portfolioAddress));
const p = decodePortfolioSummary(info!.data);
console.log(Number(p.capital) / 1e6, "USDC");
for (const pos of p.positions) console.log(pos.assetIndex, pos.marketId, pos.sizeQ);
console.log("healthy:", p.health.valid);
`}</CodeBlock>
      <UL>
        <li><Code>decodePortfolioSummary</Code>: owner, capital, PnL, funding paid/received per side, portfolioId, positionEpoch, sequence, up to 16 positions and the cached health certificate.</li>
        <li><Code>decodeImportedMarket</Code>: one 384-byte market record — status, assetIndex, marketId, close time, mark, index, external and local bid/ask, basis TWAP and funding values.</li>
        <li><Code>marketLifecycle(status)</Code>: <Code>&quot;active&quot; | &quot;restricted&quot; | &quot;reduce-only&quot; | &quot;locked&quot; | &quot;resolved&quot;</Code>.</li>
        <li><Code>discoverActivePerps</Code> / <Code>discoverTradablePerps</Code>: filter decoded markets to those listed, or those accepting new risk.</li>
      </UL>

      <H2>Running a keeper</H2>
      <P>
        Cranks are permissionless. Anyone can keep a market current with <Code>crankInstruction</Code>, passing the current slot and the asset indexes to
        update. The <Code>authority</Code> doesn’t need to sign; any portfolio in the group can be used as the crank portfolio.
      </P>
      <CodeBlock title="crank.ts">{`
import { crankInstruction } from "@moxie/sdk/instructions";

const slot = BigInt(await connection.getSlot());
const ix = crankInstruction({
  program: MOXIE.program,
  authority: payer.publicKey.toBase58(),
  market: MOXIE.market,
  portfolio: anyPortfolioAddress,
  nowSlot: slot,
  assets: [1, 2],
});
`}</CodeBlock>
      <Callout tone="note">
        A crank that has nothing to do fails with <Code>EngineNonProgress</Code>. That is expected; treat it as “already current”.
      </Callout>

      <H2>Low-level encoders</H2>
      <P>
        <Code>@moxie/sdk/percolator</Code> exposes the raw instruction data if you assemble accounts yourself. Layouts are covered by byte-exact tests in{" "}
        <Code>packages/sdk/test/wire-layout.test.ts</Code>.
      </P>
      <Table
        head={["Encoder", "Tag", "Bytes"]}
        rows={[
          [<Code key="a">buildCreatePortfolioData()</Code>, "1", "1"],
          [<Code key="b">buildDepositData(id, seq, amount)</Code>, "3", "33"],
          [<Code key="c">buildWithdrawData(id, seq, amount)</Code>, "4", "33"],
          [<Code key="d">buildPermissionlessCrankData(slot, assets)</Code>, "5", "10 + 3 per asset"],
          [<Code key="e">buildTradeCpiData(request)</Code>, "10", "85"],
          [<Code key="f">buildCloseResolvedData(feeRatePerSlot?)</Code>, "30", "17"],
          [<Code key="g">buildHardFlatData(…)</Code>, "71", "59"],
        ]}
      />
      <P>
        <Strong>Operators</Strong> listing markets use <Code>@moxie/sdk/imported-market</Code>: <Code>encodeActivateImportedPerp</Code>,{" "}
        <Code>encodePricingObservation</Code>, <Code>encodeResolutionObservation</Code> and <Code>hashIdentity</Code>.
      </P>

      <NextLink href="/docs/api" title="Indexer API" description="Read markets, charts, fills and portfolios over HTTP." />
    </>
  );
}
