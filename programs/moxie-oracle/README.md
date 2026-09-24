# Moxie activation and oracle program

This program owns the immutable external-market mapping and is the only supported V1 path for
configuring and pushing authenticated event pricing into Percolator.

Its current public workflow includes:

- `InitializeConfig`: creates the market-scoped configuration PDA.
- `ActivateImportedPerp`: creates a provider-market PDA, binds its lock-clock, activates the
  requested Percolator asset generation, and configures `AuthMark` atomically.
- `SubmitPricingObservation`: verifies full market identity, external and local impact prices,
  guarded index, health, freshness, and monotonic sequence. It derives the bounded mark on-chain
  calculates bounded absolute-point funding, and CPIs to Percolator
  `PushAuthMarkWithFunding` in the same transaction; a caller cannot choose either value.
- `AdvanceLifecycle`: monotonically advances the clock and moves Percolator into `DrainOnly`
  when the reduce-only threshold is reached.
- `HardFlatPortfolio`: lets the authorized keeper close a matched long/short pair after the
  hard-flat deadline without invoking Percolator's market-wide resolver.
- `SubmitResolution`: accepts only an identity-bound, sequential, post-close binary result from
  the configured reporter. It moves a locked imported event one-way to `Resolved` and records
  the exact terminal value (`0` or `1`).
- `SetPaused`: stops activation and new oracle observations without changing Percolator funds.

The reporter remains an explicitly trusted V1 authority. The program prevents a report for one
external market, rules snapshot, Percolator group, asset index, or generation from being replayed
against another.

```bash
cargo test --manifest-path programs/moxie-oracle/Cargo.toml
cargo build-sbf --manifest-path programs/moxie-oracle/Cargo.toml
```
