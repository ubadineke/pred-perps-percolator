import type { Metadata } from "next";
import { Callout, Code, CodeBlock, DocHeader, H2, H3, NextLink, P, Table } from "@/components/docs/prose";

export const metadata: Metadata = { title: "Indexer API" };

export default function ApiPage() {
  return (
    <>
      <DocHeader
        eyebrow="Developers"
        title="Indexer API"
        description="The indexer reads Moxie’s accounts and transactions from Solana and serves them as JSON. The website uses it for everything it shows; you can use it for bots, dashboards and analytics."
      />

      <H2>Basics</H2>
      <P>
        The indexer runs at <Code>http://localhost:8787</Code> by default (<Code>pnpm indexer:start</Code> in the monorepo; set{" "}
        <Code>SOLANA_RPC_URL</Code> and <Code>MOXIE_MARKET_ACCOUNT</Code>). All endpoints are <Code>GET</Code>, unauthenticated, and return JSON.
      </P>
      <Callout tone="note">
        Integer amounts are returned as <Code>strings</Code> to keep full precision: USDC in 6-decimal atoms, prices in E6 (<Code>&quot;491906&quot;</Code> = $0.4919),
        sizes in q units (<Code>&quot;1000000&quot;</Code> = 1 contract). Chart values are already in cents. Errors return{" "}
        <Code>{`{ "error": "not-found" }`}</Code> with a 404.
      </Callout>

      <H2>Markets</H2>
      <Table
        head={["Endpoint", "Returns"]}
        rows={[
          [<Code key="1">/v1/markets</Code>, "Every listed market with prices, lifecycle status and 24h stats."],
          [<Code key="2">/v1/markets/:address</Code>, "One market."],
          [<Code key="3">/v1/markets/:address/chart?range=1h|1d|1w|all</Code>, "Bucketed mark and index lines, trade candles and fills, ready for charting."],
          [<Code key="4">/v1/markets/:address/trades</Code>, "Fills in this market, newest first."],
          [<Code key="5">/v1/markets/:address/prices</Code>, "Raw price observations."],
          [<Code key="6">/v1/markets/:address/funding</Code>, "Funding events."],
        ]}
      />
      <CodeBlock title="GET /v1/markets/:address">{`
{
  "address": "DTixFhdpGh9vNpU4JFxp4cq5onoTwtNbm3BpJuMRL2qm",
  "provider": "panta",
  "providerMarketId": "C86nbpSX4ntRWvN4HMrdnhzHjHTtLooNtnw6k7hnmx1F",
  "title": "Saka 7+ points, GW6",
  "rules": "Resolves YES if …",
  "assetIndex": 2,
  "marketId": "3",
  "status": 1,                 // 1 active, 2 restricted, 3 reduce-only, 4 locked, 5 resolved
  "markE6": "491906",          // protected mark (the displayed price)
  "indexE6": "491899",         // source index
  "localBidE6": "484903",
  "localAskE6": "498909",
  "basisTwapE6": "7",
  "closeTime": "1791639000",   // unix seconds
  "oracleUpdatedAt": "1791582638",
  "stats": {
    "change24hCents": -0.49,
    "volume24hUsd": 0,
    "openInterestContracts": 1.996805,
    "openInterestUsd": 0.98
  }
}
`}</CodeBlock>
      <CodeBlock title="GET /v1/markets/:address/chart?range=1h">{`
{
  "range": "1h",
  "bucketSeconds": 60,
  "mark":  [{ "time": 1791582000, "value": 49.19 }, …],
  "index": [{ "time": 1791582000, "value": 49.19 }, …],
  "fills": [{ "time": 1791407564, "price": 50.78, "size": 1.99, "side": "long", "portfolio": "Em17…", "signature": "2rAQ…" }],
  "candles": [{ "time": 1791406980, "open": 50.78, "high": 50.78, "low": 50.78, "close": 50.78, "volume": 1.99 }]
}
`}</CodeBlock>
      <CodeBlock title="GET /v1/markets/:address/trades">{`
[
  {
    "signature": "2rAQHYKa…",
    "slot": 508586517,
    "blockTime": 1791407564,
    "kind": "trade",
    "marketId": "3",
    "portfolio": "Em17bXzKw2QNScV1HRSKEBLY3FnieXXkgcxzSJpEjAtj",
    "data": { "sizeQ": "1996805", "feeBps": "30", "limitPriceE6": "527804", "executionPriceE6": "507804", "executedSizeQ": "1996805" }
  }
]
`}</CodeBlock>

      <H2>Portfolios</H2>
      <Table
        head={["Endpoint", "Returns"]}
        rows={[
          [<Code key="1">/v1/portfolios/:address</Code>, "Collateral, PnL, ids needed to build transactions, health and positions."],
          [<Code key="2">/v1/portfolios/:address/positions</Code>, "Open positions only."],
          [<Code key="3">/v1/portfolios/:address/transactions</Code>, "Trades, deposits and other events for this portfolio."],
          [<Code key="4">/v1/owners/:ownerHex/portfolio</Code>, "Look up a wallet’s portfolio. ownerHex is the wallet’s 32-byte public key as lowercase hex."],
        ]}
      />
      <CodeBlock title="GET /v1/portfolios/:address">{`
{
  "address": "Em17bXzKw2QNScV1HRSKEBLY3FnieXXkgcxzSJpEjAtj",
  "owner": "b2da9311…41fcace",   // wallet public key, hex
  "capital": "99997000",          // 99.997 USDC
  "pnl": "0",
  "portfolioId": "4",
  "positionEpoch": "1",
  "sequence": "1",
  "health": { "valid": true, "equity": "…", "initialRequirement": "…", "maintenanceRequirement": "…", "liquidationDeficit": "0", "worstCaseLoss": "…" },
  "positions": [
    { "assetIndex": 2, "marketId": "3", "side": "long", "sizeQ": "1996805", "entryPriceE6": "507804", "stale": false }
  ]
}
`}</CodeBlock>
      <H3>Finding a wallet’s portfolio</H3>
      <CodeBlock title="lookup.ts">{`
import { PublicKey } from "@solana/web3.js";

const ownerHex = Buffer.from(new PublicKey(wallet).toBytes()).toString("hex");
const res = await fetch(\`http://localhost:8787/v1/owners/\${ownerHex}/portfolio\`);
const portfolio = res.status === 404 ? null : await res.json();
`}</CodeBlock>

      <H2>Source markets</H2>
      <Table
        head={["Endpoint", "Returns"]}
        rows={[
          [<Code key="1">/v1/providers/panta/markets?status=&category=&query=&limit=50</Code>, "Events available on the source prediction market."],
          [<Code key="2">/v1/providers/panta/markets/:id</Code>, "One source event."],
          [<Code key="3">/v1/providers/panta/status</Code>, "Source catalog connection status."],
        ]}
      />

      <H2>Status</H2>
      <Table
        head={["Endpoint", "Returns"]}
        rows={[
          [<Code key="1">/health</Code>, "Latest indexed slot and the last slots seen from the oracle and the keeper."],
          [<Code key="2">/v1/status/oracle</Code>, "Oracle reporter’s last slot vs. the indexed slot."],
          [<Code key="3">/v1/status/keeper</Code>, "Keeper’s last slot vs. the indexed slot."],
          [<Code key="4">/v1/events</Code>, "Every indexed event (trades, funding, deposits…), newest first."],
        ]}
      />

      <NextLink href="/docs" title="Back to the overview" description="All Moxie documentation." />
    </>
  );
}
