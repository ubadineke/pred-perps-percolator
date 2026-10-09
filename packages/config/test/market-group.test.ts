import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { toPercolatorInitMarket, validateMarketGroupConfig } from "../src/market-group.ts";

const config = JSON.parse(await readFile(new URL("../../../config/percolator.market-group.json", import.meta.url), "utf8"));
const simulationConfig = JSON.parse(await readFile(new URL("../../../config/percolator.simulation-5x.json", import.meta.url), "utf8"));

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

test("the devnet simulation profile enables five-times entry leverage", () => {
  validateMarketGroupConfig(simulationConfig);
  const init = toPercolatorInitMarket(simulationConfig);
  assert.equal(init.max_portfolio_assets, 8);
  assert.equal(init.initial_margin_bps, 2_000);
  assert.equal(init.maintenance_margin_bps, 1_000);
  assert.equal(init.liquidation_fee_bps, 100);
  assert.equal(init.liquidation_fee_cap, 50_000n);
  assert.equal(init.min_liquidation_abs, 0n);
  assert.equal(init.min_nonzero_mm_req, 2n);
  assert.equal(init.min_nonzero_im_req, 3n);
  assert.equal(init.max_price_move_bps_per_slot, 10);
  assert.equal(init.max_price_move_bps_per_slot * init.max_accrual_dt_slots, 100);
  assert.equal(10_000 / init.initial_margin_bps, 5);
});

test("liquidation fee minimum cannot exceed its cap", () => {
  const invalid = structuredClone(simulationConfig);
  invalid.risk.minLiquidationFeeAtoms = invalid.risk.liquidationFeeCapAtoms + 1;
  assert.throws(() => validateMarketGroupConfig(invalid), /minLiquidationFeeAtoms/);
});
