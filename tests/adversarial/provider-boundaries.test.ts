import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ELIGIBILITY_POLICY,
  normalizeJupiterMarket,
  type ExternalMarket,
} from "../../packages/provider-adapter/src/index.ts";
import {
  ActivatedRulesChangedError,
  MarketCatalog,
} from "../../packages/market-catalog/src/index.ts";

const NOW = Date.UTC(2026, 8, 14);

const eligible: ExternalMarket = {
  provider: "jupiter",
  providerMarketId: "immutable-market",
  title: "Will the event occur?",
  description: "Adversarial fixture",
  rules: "YES only after a final provider result.",
  openTime: NOW - 1_000,
  closeTime: NOW + 7 * 86_400_000,
  status: "open",
  result: null,
  yesBidE6: 480_000,
  yesAskE6: 520_000,
  noBidE6: 480_000,
  noAskE6: 520_000,
  volumeUsdE6: 2_000_000_000n,
  observedAt: NOW,
  raw: {},
};

test("malformed provider identity fails closed", () => {
  assert.throws(
    () => normalizeJupiterMarket({ metadata: { title: "No stable ID", closeTime: NOW } }, NOW),
    /missing marketId/,
  );
});

test("activated rules cannot be swapped by a later provider response", () => {
  const catalog = new MarketCatalog(DEFAULT_ELIGIBILITY_POLICY, () => NOW);
  const [record] = catalog.ingest([eligible]);
  catalog.activate(record.key);

  assert.throws(
    () => catalog.ingest([{ ...eligible, rules: "replacement rules" }]),
    ActivatedRulesChangedError,
  );
  assert.equal(catalog.get(record.key)?.stale, true);
  assert.equal(catalog.get(record.key)?.market.rules, eligible.rules);
});

test("provider outage labels prior data stale", () => {
  const catalog = new MarketCatalog(DEFAULT_ELIGIBILITY_POLICY, () => NOW);
  const [record] = catalog.ingest([eligible]);
  catalog.markRefreshFailed(new Error("rate limited"));
  assert.deepEqual(
    { stale: catalog.get(record.key)?.stale, error: catalog.get(record.key)?.lastRefreshError },
    { stale: true, error: "rate limited" },
  );
});

