import assert from "node:assert/strict";
import test from "node:test";
import { buildMarketStats } from "../src/market-stats.ts";
import type { EventProjection, PortfolioProjection, PricePoint } from "../src/store.ts";

const now = 1_000_000;
const price = (observedAt: number, markE6: string): PricePoint => ({ slot: observedAt, observedAt: String(observedAt), markE6, indexE6: markE6, localMidE6: markE6, basisTwapE6: "0" });
const trade = (blockTime: number, sizeQ: string, executionPriceE6: string): EventProjection => ({
  signature: `s${blockTime}`, instructionIndex: 0, slot: blockTime, kind: "trade", marketId: "3", blockTime, data: { sizeQ, executedSizeQ: sizeQ, executionPriceE6 },
});
const health = { valid: true, equity: "0", initialRequirement: "0", maintenanceRequirement: "0", liquidationDeficit: "0", worstCaseLoss: "0" };
const portfolio = (positions: PortfolioProjection["positions"]): PortfolioProjection => ({
  address: "p", owner: "o", slot: 1, capital: "0", pnl: "0", portfolioId: "1", positionEpoch: "0", sequence: "0", health, positions,
});

test("summarises 24h change, volume and open interest", () => {
  const stats = buildMarketStats(
    { assetIndex: 2, marketId: "3", markE6: "520000" },
    [price(now - 80_000, "500000"), price(now - 100, "520000")],
    [trade(now - 3_600, "2000000", "510000"), trade(now - 200_000, "9000000", "500000")],
    [
      portfolio([{ slot: 0, assetIndex: 2, marketId: "3", side: "long", sizeQ: "3000000", entryNotional: "1500000", stale: false }]),
      portfolio([{ slot: 0, assetIndex: 2, marketId: "3", side: "short", sizeQ: "-3000000", entryNotional: "1500000", stale: false }]),
      portfolio([{ slot: 0, assetIndex: 1, marketId: "2", side: "long", sizeQ: "5000000", entryNotional: "2500000", stale: false }]),
    ],
    now,
  );
  assert.equal(stats.change24hCents, 2);
  // Only the fill inside 24h counts: 2 contracts × 51¢.
  assert.equal(stats.volume24hUsd, 1.02);
  assert.equal(stats.openInterestContracts, 3);
  assert.equal(stats.openInterestUsd, 1.56);
});

test("reports no change without history", () => {
  const stats = buildMarketStats({ assetIndex: 1, marketId: "2", markE6: "500000" }, [], [], [], now);
  assert.equal(stats.change24hCents, null);
  assert.equal(stats.volume24hUsd, 0);
});
