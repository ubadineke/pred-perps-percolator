import assert from "node:assert/strict";
import test from "node:test";
import { planKeeperWork } from "../src/planner.ts";

test("prioritizes refresh, funding, then deterministic liquidation", () => {
  assert.deepEqual(planKeeperWork({
    lifecycle: "active", oracleFresh: false, fundingPending: true,
    portfolios: [
      { address: "B", maintenanceHealthy: false, positionCount: 1 },
      { address: "A", maintenanceHealthy: false, positionCount: 1 },
    ],
  }), [
    { kind: "refresh-oracle" }, { kind: "crank-funding" },
    { kind: "liquidate", portfolio: "A" }, { kind: "liquidate", portfolio: "B" },
  ]);
});

test("locked markets stop pricing work and await one-way resolution", () => {
  assert.deepEqual(planKeeperWork({
    lifecycle: "locked", oracleFresh: false, fundingPending: true, portfolios: [],
  }), [{ kind: "await-resolution" }]);
});

test("resolved markets produce no repeat work", () => {
  assert.deepEqual(planKeeperWork({
    lifecycle: "resolved", oracleFresh: false, fundingPending: true,
    portfolios: [{ address: "A", maintenanceHealthy: false, positionCount: 1 }],
  }), []);
});
