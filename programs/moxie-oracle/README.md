# Moxie activation and oracle program

This program owns the immutable external-market mapping and is the only supported V1 path for
configuring and pushing authenticated event probabilities into Percolator.

It provides four instructions:

- `InitializeConfig`: creates the market-scoped configuration PDA.
- `ActivateImportedPerp`: creates a provider-market PDA, activates the requested Percolator
  asset generation, and configures `AuthMark` atomically.
- `SubmitObservation`: verifies full market identity, freshness, and monotonic sequence, then
  CPIs to Percolator `PushAuthMark` in the same transaction.
- `SetPaused`: stops activation and new oracle observations without changing Percolator funds.

The reporter remains an explicitly trusted V1 authority. The program prevents a report for one
external market, rules snapshot, Percolator group, asset index, or generation from being replayed
against another.

```bash
cargo test --manifest-path programs/moxie-oracle/Cargo.toml
cargo build-sbf --manifest-path programs/moxie-oracle/Cargo.toml
```

