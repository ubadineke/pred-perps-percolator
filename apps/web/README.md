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

## Routes

- `/` — immersive product landing page
- `/markets` — market discovery and comparison
- `/trade/[slug]` — trading terminal
- `/portfolio` — shared-margin portfolio
- `/technology` — engine and responsibility boundaries
