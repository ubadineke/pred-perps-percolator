# Moxie probability math

Shared, `no_std` fixed-point primitives for live binary prices, conservative
rounding, oracle-health classification, and index-anchored mark construction.

All live values use probability e6. Exact `0` and `1_000_000` remain reserved
for authenticated terminal settlement.

The Rust fixed-point implementation begins with Phase 6. V1 uses probability e6 and USDC atoms
with explicit rounding at every program boundary.
