# Moxie Prediction Perps

Moxie turns selected external binary prediction markets into leveraged Solana perps. Jupiter
is the first V1 source; the provider owns the event and resolution, while Moxie owns the
derivative, execution policy, margin, and settlement path.

## Current implementation status

Phases 1–5 establish the pinned Percolator foundation, workspace, provider adapter, external
market catalog, and a locally deployed shared-USDC Percolator market group. Asset activation,
Phases 6–8 add immutable provider-market activation, authenticated probability marks,
and a Percolator ABI v3 LP matcher. The local proof now funds trader/LP portfolios, binds
the LP matcher, executes a real `TradeCpi`, and proves equal-and-opposite accounting plus
user-limit rejection.

```bash
pnpm run build
pnpm test
pnpm run verify:upstream
pnpm run config:market-group
```

With `solana-test-validator` running, `pnpm run deploy:local` deploys the pinned wrapper and
matcher and oracle adapter, creates mock USDC and the canonical vault, imports a provider market,
funds trader/LP portfolios, binds the matcher, and executes the engine demo. Then run
`pnpm run verify:local` to verify the onchain accounts and recorded proof.

Live Jupiter access requires `JUPITER_API_KEY`; unit tests use committed fixtures.
