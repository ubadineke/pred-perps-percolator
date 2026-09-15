import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_ELIGIBILITY_POLICY, type ExternalMarket } from "../../provider-adapter/src/index.ts";
import { ActivatedRulesChangedError, MarketCatalog } from "../src/index.ts";

const NOW = Date.UTC(2026, 8, 14);
const market: ExternalMarket = {
  provider: "jupiter",
  providerMarketId: "market-1",
  title: "Will SOL exceed $250?",
  description: "A test market",
  rules: "YES if the provider publishes a YES result.",
  openTime: NOW - 1_000,
  closeTime: NOW + 7 * 86_400_000,
  status: "open",
  result: null,
  yesBidE6: 490_000,
  yesAskE6: 510_000,
  noBidE6: 490_000,
  noAskE6: 510_000,
  volumeUsdE6: 10_000_000_000n,
  observedAt: NOW,
  raw: {},
};

test("keeps discovery separate from controlled activation", () => {
  const catalog = new MarketCatalog(DEFAULT_ELIGIBILITY_POLICY, () => NOW);
  const [entry] = catalog.ingest([market]);
  assert.equal(entry.state, "ELIGIBLE_FOR_PERP");
  assert.equal(catalog.activate(entry.key).state, "PERP_ACTIVE");
});

test("freezes resolution rules at activation", () => {
  const catalog = new MarketCatalog(DEFAULT_ELIGIBILITY_POLICY, () => NOW);
  const [entry] = catalog.ingest([market]);
  catalog.activate(entry.key);
  assert.throws(
    () => catalog.ingest([{ ...market, rules: "silently changed rules" }]),
    ActivatedRulesChangedError,
  );
  const retained = catalog.get(entry.key);
  assert.equal(retained?.market.rules, market.rules);
  assert.equal(retained?.stale, true);
});

test("provider failures visibly stale existing records", () => {
  const catalog = new MarketCatalog(DEFAULT_ELIGIBILITY_POLICY, () => NOW);
  const [entry] = catalog.ingest([market]);
  catalog.markRefreshFailed(new Error("provider unavailable"));
  assert.equal(catalog.get(entry.key)?.stale, true);
  assert.equal(catalog.get(entry.key)?.lastRefreshError, "provider unavailable");
});

test("search filters the catalog without activating records", () => {
  const catalog = new MarketCatalog(DEFAULT_ELIGIBILITY_POLICY, () => NOW);
  catalog.ingest([market, { ...market, providerMarketId: "market-2", title: "Will BTC exceed $100k?" }]);
  const matches = catalog.search("btc", ["ELIGIBLE_FOR_PERP"]);
  assert.deepEqual(matches.map((entry) => entry.key), ["jupiter:market-2"]);
});

