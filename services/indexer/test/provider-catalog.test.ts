import assert from "node:assert/strict";
import test from "node:test";
import { PantaPredictionSource } from "../../../packages/provider-adapter/src/index.ts";
import { PantaCatalogService } from "../src/provider-catalog.ts";

const page = {
  items: [{
    marketId: "panta-1", title: "Will it happen?", description: "", phase: "primary",
    marketType: "standard", status: "primary", startTime: 1_790_000_000,
    endTime: 1_800_000_000, resolutionTime: 1_800_000_000,
    yesPrice: "0.55", noPrice: "0.45", volumeUsdcBase: "1000000",
  }],
  nextCursor: null,
};

test("Panta provider catalog caches normalized pages", async () => {
  let calls = 0;
  const source = new PantaPredictionSource({
    apiKey: "pk_live_test",
    fetchImpl: async () => { calls += 1; return Response.json(page); },
    now: () => 1_790_000_100_000,
  });
  const catalog = new PantaCatalogService(source, { ttlMs: 60_000 });
  const first = await catalog.markets();
  const second = await catalog.markets();
  assert.equal(first[0]?.provider, "panta");
  assert.equal(first[0]?.indexPriceE6, 550_000);
  assert.equal(first[0]?.raw, undefined);
  assert.equal(second.length, 1);
  assert.equal(calls, 2); // one catalog request plus one detail hydration
  assert.equal(catalog.status.stale, false);
});

test("Panta provider catalog hydrates catalog-only rows from market detail", async () => {
  const summary = {
    items: [{
      eventPda: "panta-live-1", title: "Will BTC clear the strike?", description: "",
      status: "primary", startTime: 1_790_000_000, endTime: 1_800_000_000,
    }],
    nextCursor: null,
  };
  const detailed = {
    eventPda: "panta-live-1", title: "Will BTC clear the strike?", description: "",
    status: "primary", startTime: 1_790_000_000, endTime: 1_800_000_000,
    yesPrice: 0.61, noPrice: 0.39, resolutionRule: "Official close price.",
  };
  const paths: string[] = [];
  const source = new PantaPredictionSource({
    apiKey: "pk_live_test",
    fetchImpl: async (input) => {
      const path = new URL(String(input)).pathname;
      paths.push(path);
      return Response.json(path.endsWith("/markets/") ? summary : detailed);
    },
    now: () => 1_790_000_100_000,
  });
  const catalog = new PantaCatalogService(source, { ttlMs: 60_000 });
  const markets = await catalog.markets();
  assert.equal(markets[0]?.indexPriceE6, 610_000);
  assert.equal(markets[0]?.rules, "Official close price.");
  assert.deepEqual(paths, ["/api/v1/markets/", "/api/v1/markets/panta-live-1/"]);
});
