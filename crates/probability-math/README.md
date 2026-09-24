# Moxie probability math

Shared, `no_std` fixed-point primitives for live binary prices, conservative
rounding, oracle-health classification, index-anchored mark construction,
directional terminal margin, bounded funding, and the lock-clock.

All live values use probability e6. Exact `0` and `1_000_000` remain reserved
for authenticated terminal settlement.

V1 uses probability e6 and USDC atoms with explicit rounding at every program boundary.
