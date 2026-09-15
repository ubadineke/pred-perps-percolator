# Moxie matcher

LP-scoped Percolator matcher ABI v3 implementation. Percolator calls it through
`TradeCpi`; it cannot mutate the Percolator market or either portfolio.

Quotes combine side-aware spread, size impact, inventory skew, oracle-health
allowance, and hedge-cost allowance. V1 is fill-or-kill: expiry, pause, size, and
inventory-limit failures return a bound rejection. Percolator independently checks
the delegate tuple, returned identity, fill direction/size, and signed limit price.

Instructions: tag `0` matcher call, tag `2` context initialization, tag `4` pause.
