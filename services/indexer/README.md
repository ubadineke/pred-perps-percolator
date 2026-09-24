# Indexer

Provider-neutral derived read model for markets, portfolios, trades, funding, liquidation,
resolution, oracle freshness, and keeper health. Writes are idempotent by account slot or
`signature:instructionIndex`; `rebuild()` deletes projections and backfills them from chain.

The JSON-RPC source discovers oracle records and fixed-size Percolator portfolios, then
backfills recognized protocol instructions. A versioned JSON snapshot is written atomically
for fast restarts; it may always be discarded and rebuilt from Solana.

HTTP routes include `/health`, markets and their trade/funding histories, portfolios and
their positions/transactions, protocol events, and oracle/keeper status. Start with
`MOXIE_ORACLE_PROGRAM_ID=... PERCOLATOR_PROGRAM_ID=... pnpm indexer:start`. Solana remains
authoritative.
