# Moxie Application Guide

This guide runs the complete local Moxie stack:

```text
Solana test validator
  → Percolator + Moxie matcher + Moxie oracle programs
  → local market/bootstrap proof
  → indexer and HTTP API
  → Next.js frontend
```

The Solana accounts are authoritative. The indexer is a disposable read layer, and the
frontend reads markets and portfolios from its API.

## 1. Prerequisites

Install:

- Node.js 22.18 or newer;
- pnpm 10;
- Rust and Cargo;
- the Solana CLI with `cargo build-sbf` and `solana-test-validator` available.

Confirm the tools:

```bash
node --version
pnpm --version
rustc --version
solana --version
cargo build-sbf --version
```

Clone submodules and install JavaScript dependencies:

```bash
git submodule update --init --recursive
pnpm install
cp .env.example .env
```

Do not commit `.env`, generated keypairs, the local ledger, or the index snapshot.

## 2. Build and test the repository

Build the JavaScript/TypeScript packages and run the test suites:

```bash
pnpm build
pnpm build:web
pnpm test
pnpm verify:upstream
```

Build the three Solana programs. This creates the `.so` files and program keypairs required
by `deploy:local`:

```bash
cargo build-sbf --manifest-path vendor/percolator-prog/Cargo.toml
cargo build-sbf --manifest-path programs/moxie-matcher/Cargo.toml
cargo build-sbf --manifest-path programs/moxie-oracle/Cargo.toml
```

Program artifacts are written inside each program's `target/deploy` directory.

## 3. Start local Solana

Open terminal 1 from the repository root:

```bash
solana-test-validator --reset
```

Leave it running. In another terminal, point the CLI at localnet and fund the configured payer:

```bash
solana config set --url http://127.0.0.1:8899
solana airdrop 100
solana balance
```

`--reset` creates a new chain. Every account address from an older local run becomes invalid.

## 4. Deploy and seed Moxie

From terminal 2:

```bash
pnpm deploy:local
pnpm verify:local
```

The deployment command:

1. deploys Percolator, the Moxie matcher, and the Moxie oracle;
2. creates mock USDC and the collateral vault;
3. creates the shared Percolator market group;
4. imports the configured prediction-market fixtures;
5. creates and funds trader and LP portfolios;
6. executes a real matcher-routed `TradeCpi`;
7. proves funding, hard-flat, resolution, and withdrawal behavior on the demonstration market.

Deployment addresses and proof results are written to:

```text
deployments/localnet.local.json
```

The deterministic bootstrap completes the lifecycle proof on its demonstration market. Other
imported records may remain available for discovery/indexing. This is a protocol proof fixture,
not a long-running live market simulator.

## 5. Configure the indexer and frontend

Open `deployments/localnet.local.json` and copy these values into `.env`:

| `.env` variable | Deployment JSON field |
| --- | --- |
| `PERCOLATOR_PROGRAM_ID` | `percolatorProgramId` |
| `MOXIE_ORACLE_PROGRAM_ID` | `oracleProgramId` |
| `MOXIE_USDC_MINT` | `usdcMint` |
| `MOXIE_MARKET_ACCOUNT` | `marketAccount` |
| `MOXIE_MARKET_AUTHORITY` | `marketAuthority` |
| `MOXIE_PORTFOLIO_ADDRESS` | `engineDemo.traderPortfolio` |

Keep these local defaults:

```env
SOLANA_RPC_URL=http://127.0.0.1:8899
MOXIE_CLUSTER=localnet
MOXIE_API_URL=http://127.0.0.1:8787
```

`MOXIE_PORTFOLIO_ADDRESS` controls which indexed shared-margin portfolio appears on the
Portfolio page. It is temporary until wallet-based portfolio discovery is connected.

## 6. Start the indexer and API

Open terminal 3:

```bash
pnpm indexer:start
```

The service reads the program IDs from `.env`, backfills recognized transactions, indexes
market and portfolio accounts, and listens on port `8787`.

Check it:

```bash
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/v1/markets
```

Useful endpoints:

- `GET /health`
- `GET /v1/markets`
- `GET /v1/markets/:recordAddress`
- `GET /v1/markets/:recordAddress/trades`
- `GET /v1/markets/:recordAddress/funding`
- `GET /v1/portfolios/:portfolioAddress`
- `GET /v1/portfolios/:portfolioAddress/positions`
- `GET /v1/portfolios/:portfolioAddress/transactions`
- `GET /v1/events`
- `GET /v1/status/oracle`
- `GET /v1/status/keeper`

The restart snapshot is stored at `.data/moxie-index.json` and is ignored by Git.

## 7. Start the frontend

Configure browser wallets in `.env`:

```env
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
```

Create the app ID in the Privy dashboard and allow the frontend origin (`http://localhost:3000`
for local development). Enable Email and Google as login methods. Only the app ID is public; never
put a Privy app secret, a wallet private key, or a keypair path in a `NEXT_PUBLIC_` variable.

If `NEXT_PUBLIC_PRIVY_APP_ID` is omitted, the site still supports installed Wallet Standard
wallets such as Phantom, Solflare, and Backpack. Privy login is shown as unavailable instead of
preventing the rest of the application from loading.

Open terminal 4:

```bash
pnpm dev:web
```

Open [http://localhost:3000](http://localhost:3000).

Pages:

- `/` — landing page and indexed market strip;
- `/markets` — markets read from the indexer;
- `/trade/:recordAddress` — terminal populated with the selected market's index and mark;
- `/portfolio` — the portfolio configured through `MOXIE_PORTFOLIO_ADDRESS`;
- `/technology` — protocol architecture.

## 8. What can be exercised today

You can currently:

- deploy and verify the protocol on localnet;
- import prediction-market fixtures into Percolator assets;
- prove a matcher-routed perp trade and equal-and-opposite positions;
- inspect indexed mark/index values and lifecycle state;
- inspect shared collateral, PnL, active position legs, and certified account health;
- query transaction-derived trade, funding, crank, liquidation, and resolution events;
- connect through Privy email/Google onboarding or an installed Solana wallet;
- use the frontend order ticket as a position preview.

The browser does **not yet submit transactions**. Wallet-owned portfolio discovery, deposits,
withdrawals, and signed order submission are the next frontend integration stage. The SDK
builders for those protocol instructions already exist, and the active wallet connector is now
available for that signing layer.

## 9. Using a live Jupiter market

Add `JUPITER_API_KEY` to `.env`, then run:

```bash
pnpm smoke:jupiter
pnpm deploy:local:live
```

The smoke command validates API access and writes the selected normalized market manifest before
deployment. Never commit the API key or generated live-market deployment data.

## 10. Restarting after a validator reset

After stopping or resetting the validator:

1. stop the indexer and frontend;
2. remove `.data/moxie-index.json` so stale local-chain projections are not restored;
3. restart the validator;
4. airdrop SOL to the configured payer;
5. run `pnpm deploy:local` again;
6. refresh `.env` from the new deployment JSON;
7. restart the indexer and frontend.

## 11. Troubleshooting

### Missing `.so` or program-keypair file

Run the three `cargo build-sbf` commands in section 2 before deploying.

### `Connection refused` on port 8899

The validator is not running. Start `solana-test-validator` and leave that terminal open.

### Insufficient funds during deployment

Run:

```bash
solana airdrop 100
solana balance
```

### Indexer says a program ID is required

Copy `percolatorProgramId` and `oracleProgramId` from `deployments/localnet.local.json` into
`PERCOLATOR_PROGRAM_ID` and `MOXIE_ORACLE_PROGRAM_ID` in `.env`.

### Frontend says market data is unavailable

Confirm the indexer is running and that this succeeds:

```bash
curl http://127.0.0.1:8787/health
```

Also confirm `MOXIE_API_URL=http://127.0.0.1:8787` in `.env`.

### Portfolio page says no portfolio is selected

Set `MOXIE_PORTFOLIO_ADDRESS` to `engineDemo.traderPortfolio` from the current deployment JSON,
then restart the Next.js development server.

### Old markets appear after resetting localnet

Stop the indexer, remove `.data/moxie-index.json`, and restart it after redeployment.

## 12. Deploying the suite to devnet

Devnet uses the same persistent program keypairs but writes a separate deployment manifest.
Set an RPC endpoint in `.env`:

```env
DEVNET_RPC_URL=https://api.devnet.solana.com
```

For repeated deployments, a dedicated provider RPC is preferable to the rate-limited public
endpoint. Confirm the deployment signer and balance before broadcasting:

```bash
solana config get
solana address
solana balance --url "$DEVNET_RPC_URL"
```

Fund that address with devnet SOL if necessary, then deploy and verify:

```bash
pnpm deploy:devnet
pnpm verify:devnet
```

The command deploys all three programs, bootstraps the mock-USDC market group, runs the same
protocol proof, and writes addresses to:

```text
deployments/devnet.local.json
```

That file and all deployment keypairs remain ignored by Git. To point the application suite at
devnet, copy its program, market, mint, and portfolio values into `.env`, change
`SOLANA_RPC_URL` and `MOXIE_CLUSTER`, and restart the indexer and frontend:

```env
SOLANA_RPC_URL=https://api.devnet.solana.com
MOXIE_CLUSTER=devnet
```

To import a live Jupiter-selected market during bootstrap instead of the committed fixtures:

```bash
pnpm deploy:devnet:live
pnpm verify:devnet
```
