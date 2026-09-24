import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { toPercolatorInitMarket, validateMarketGroupConfig } from "../src/market-group.ts";

const config = JSON.parse(await readFile(new URL("../../../config/percolator.market-group.json", import.meta.url), "utf8"));

test("the checked-in V1 market group is valid and maps to InitMarket", () => {
  validateMarketGroupConfig(config);
  const init = toPercolatorInitMarket(config);
  assert.equal(init.max_portfolio_assets, 8);
  assert.equal(init.initial_price, 500_000);
  assert.equal(init.initial_margin_bps, 10_000);
  assert.equal(init.maintenance_margin_bps, 10_000);
  assert.equal(init.max_abs_funding_e9_per_slot, 10_000);
});

test("initial margin cannot be below maintenance margin", () => {
  const invalid = structuredClone(config);
  invalid.risk.initialMarginBps = 3_000;
  assert.throws(() => validateMarketGroupConfig(invalid), /initialMarginBps/);
});
