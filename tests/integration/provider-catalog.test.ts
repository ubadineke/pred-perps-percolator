import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_ELIGIBILITY_POLICY,
  JupiterPredictionSource,
} from "../../packages/provider-adapter/src/index.ts";
import { MarketCatalog } from "../../packages/market-catalog/src/index.ts";

const NOW = Date.UTC(2026, 8, 14, 0, 0, 0);
const fixture = JSON.parse(
  await readFile(
    new URL("../../packages/provider-adapter/test/fixtures/jupiter-markets.json", import.meta.url),
    "utf8",
  ),
);

test("Jupiter discovery feeds controlled catalog activation without creating a perp", async () => {
  const source = new JupiterPredictionSource({
    apiKey: "fixture-key",
    now: () => NOW,
    fetchImpl: async () => Response.json(fixture),
  });
  const markets = await source.listMarkets({ status: "open" });
  const catalog = new MarketCatalog(DEFAULT_ELIGIBILITY_POLICY, () => NOW);
  const records = catalog.ingest(markets);

  const eligible = records.find((record) => record.market.providerMarketId === "jup-sol-250-friday");
  const rejected = records.find((record) => record.market.providerMarketId === "jup-stale-market");

  assert.equal(eligible?.state, "ELIGIBLE_FOR_PERP");
  assert.equal(rejected?.state, "REFERENCE_ONLY");
  assert.equal(catalog.search("SOL")[0]?.state, "ELIGIBLE_FOR_PERP");
  assert.equal(catalog.activate(eligible!.key).state, "PERP_ACTIVE");
});

