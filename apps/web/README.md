# Moxie web

Next.js (App Router) frontend for Moxie: market discovery, the trading terminal, and the shared-margin portfolio.

## Run locally

The app reads its settings from the **root** `.env`. Next.js only loads `.env` files from `apps/web`, so export the root file into the environment when starting it:

```bash
cd moxie
set -a && source .env && set +a
cd apps/web && pnpm exec next dev --port 3001
```

It also needs the indexer API (`pnpm indexer:start`, default `http://127.0.0.1:8787`). For trading to work once positions exist, keep a keeper running (`tools/moxie-bootstrap` → `keeper_loop`) and, for live prices, the oracle reporter (`pnpm oracle:start`).

## Routes

- `/` — landing page with a live featured market
- `/markets` — tradable markets and Panta source markets
- `/trade` — opens the first tradable market
- `/trade/[slug]` — trading terminal (chart, order ticket, positions, fills)
- `/portfolio` — the connected wallet's portfolio: equity, positions, deposit and withdraw
- `/technology` — how the system fits together
- `/admin/markets` — market admission (linked in the nav only for the market authority wallet)

## Structure

- `app/globals.css` — Tailwind v4 entry and **all design tokens** (`@theme`). Use token utilities (`bg-surface`, `text-muted`, `border-border`, `text-long`, …); never raw hex values.
- `components/ui/` — shared primitives (Button, Badge, Panel, Stat, Segmented, AmountField, Alert, EmptyState, Skeleton, PageHeader, MarketAvatar). Build pages from these.
- `components/trade/`, `components/account/` — terminal and account features.
- `hooks/use-moxie-account.ts` — the connected wallet's portfolio, USDC balance and every account action (create, faucet, deposit, withdraw, trade, close), with plain-language errors from `lib/errors.ts`.
- `lib/moxie-client.ts` — pure transaction builders, matcher quote and margin-aware order sizing.
- `lib/format.ts` — formatting for cents, USD, contracts, addresses and countdowns.

Brand rules (palette, typography, voice) live in the repo-root `brand.md`.

## Environment

Server-side (from the root `.env`): `PERCOLATOR_PROGRAM_ID`, `MOXIE_MATCHER_PROGRAM_ID`, `MOXIE_ORACLE_PROGRAM_ID`, `MOXIE_MARKET_ACCOUNT`, `MOXIE_USDC_MINT`, `MOXIE_COLLATERAL_VAULT`, `MOXIE_LP_PORTFOLIO`, `MOXIE_MATCHER_CONTEXT`, `MOXIE_MATCHER_DELEGATE`, `MOXIE_MARKET_AUTHORITY`, `MOXIE_CLUSTER`, optional `MOXIE_MAX_LEVERAGE` (default 1), `MOXIE_API_URL`.

Browser-safe: `NEXT_PUBLIC_SOLANA_RPC_URL` (defaults to public devnet), `NEXT_PUBLIC_PRIVY_APP_ID` (optional email/Google login), `NEXT_PUBLIC_MOXIE_API_URL`. Never put secrets in `NEXT_PUBLIC_` variables.

The devnet faucet route (`/api/devnet/faucet`) mints mock USDC with the local `~/.config/solana/id.json` (the mock mint's authority), up to 10,000 per request, and refuses non-devnet clusters.
