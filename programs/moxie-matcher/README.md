# Moxie matcher

LP-scoped Percolator matcher ABI v3 implementation. Percolator calls it through
`TradeCpi`; it cannot mutate the Percolator market or either portfolio.

Quotes use absolute probability-point charges: side-aware spread, average
pre/post-trade inventory skew, size impact, oracle health, divergence,
time-to-lock, and external hedge cost. V1 is fill-or-kill: expiry, live-bound,
pause, size, and inventory-limit failures return a bound rejection. The configured
lock-clock reduces fill/capacity in `Restricted`, permits only inventory reduction
in `ReduceOnly`, and rejects every fill at `Locked`. Percolator
independently checks the delegate tuple, returned identity, fill direction/size,
and signed limit price.

Instructions: tag `0` matcher call, tag `6` pricing/lifecycle-v3 context initialization,
tag `4` pause. Tag `2` remains a compatibility initializer for older clients.
