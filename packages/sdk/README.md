# @moxie/sdk

TypeScript helpers for Moxie: instruction builders, order sizing, matcher quotes and account decoders.
No runtime dependencies; works with any Solana client library. Full guide with examples: `/docs/sdk`
in the web app (`apps/web/app/docs/sdk/page.tsx`).

## Entry points

| Import                       | Contents                                                                 |
| ---------------------------- | ------------------------------------------------------------------------ |
| `@moxie/sdk/trading`         | `planOrder`, `marginPerContract`, `quoteMatcher`, `limitFor`, `FEE_BPS`  |
| `@moxie/sdk/instructions`    | Portfolio, deposit, withdraw, trade and crank instructions               |
| `@moxie/sdk/accounts`        | `decodePortfolioSummary`, `decodeImportedMarket`, `marketLifecycle`      |
| `@moxie/sdk/percolator`      | Raw Percolator instruction-data encoders                                 |
| `@moxie/sdk/imported-market` | Oracle encoders for listing, pricing and resolving markets (Node only)   |
| `@moxie/sdk`                 | Everything (pulls in `node:crypto`; prefer subpaths in the browser)      |

## Units

All protocol amounts are `bigint`s until display: USDC in 6-decimal atoms (`1_000_000n` = $1),
prices in E6 (`500_000n` = 50¢), sizes in q units (`1_000_000n` = 1 contract; positive = long).

## Placing a trade

```ts
import { planOrder, quoteMatcher, limitFor, FEE_BPS } from "@moxie/sdk/trading";
import { tradeInstruction } from "@moxie/sdk/instructions";

const plan = planOrder("long", 50, Number(markE6) / 10_000);   // $50 of collateral
const quote = quoteMatcher(matcherContextData, markE6, plan!.sizeQ);
const ix = tradeInstruction({ /* accounts + portfolio ids */, sizeQ: plan!.sizeQ, feeBps: FEE_BPS, limitPriceE6: limitFor(quote, plan!.sizeQ) });
```

Send trades and withdrawals with a 128 KB heap frame and a 1.4M compute-unit limit.

## Tests

`pnpm test` runs byte-exact wire-layout tests (`test/wire-layout.test.ts`) and sizing/quote tests.
