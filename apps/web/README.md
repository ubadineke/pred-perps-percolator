# Moxie web

The public Moxie experience and prediction-perps trading workstation.

## Run locally

From the repository root:

```bash
pnpm install
pnpm dev:web
```

Then open `http://localhost:3000`.

The current UI uses representative market data while the wallet, indexer, oracle stream, and transaction SDK are connected. The order ticket calculations are interactive but do not submit transactions yet.

## Wallets

Set these browser-safe variables in the root `.env`:

```env
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
```

The header exposes one wallet dialog with two paths: Privy email/Google onboarding with an
embedded Solana wallet, or any installed Wallet Standard wallet such as Phantom, Solflare, or
Backpack. Regular wallet connection continues to work when the Privy app ID is absent. Never use
a Privy secret or private key in a `NEXT_PUBLIC_` variable.

## Routes

- `/` — immersive product landing page
- `/markets` — market discovery and comparison
- `/trade/[slug]` — trading terminal
- `/portfolio` — shared-margin portfolio
- `/technology` — engine and responsibility boundaries
## Indexer connection

The markets, terminal header, and optional portfolio view read from the Moxie indexer API.
Set `MOXIE_API_URL` to the server-side API origin (defaults to `http://127.0.0.1:8787`).
Set `MOXIE_PORTFOLIO_ADDRESS` to render one indexed shared-margin account until wallet-based
portfolio discovery is enabled. Transaction submission remains a separate wallet/SDK path.
