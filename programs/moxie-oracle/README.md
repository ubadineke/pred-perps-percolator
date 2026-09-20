# Moxie activation and oracle program

This program owns the immutable external-market mapping and is the only supported V1 path for
configuring and pushing authenticated event pricing into Percolator.

It provides four instructions:

- `InitializeConfig`: creates the market-scoped configuration PDA.
- `ActivateImportedPerp`: creates a provider-market PDA, activates the requested Percolator
  asset generation, and configures `AuthMark` atomically.
- `SubmitPricingObservation`: verifies full market identity, external and local impact prices,
  guarded index, health, freshness, and monotonic sequence. It derives the bounded mark on-chain
  and CPIs to Percolator `PushAuthMark` in the same transaction; a caller cannot choose the mark.
- `SetPaused`: stops activation and new oracle observations without changing Percolator funds.

The reporter remains an explicitly trusted V1 authority. The program prevents a report for one
external market, rules snapshot, Percolator group, asset index, or generation from being replayed
against another.

```bash
cargo test --manifest-path programs/moxie-oracle/Cargo.toml
cargo build-sbf --manifest-path programs/moxie-oracle/Cargo.toml
```
