import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildCatalog,
  JupiterPredictionSource,
  normalizeJupiterMarket,
  UnsupportedProviderCapabilityError,
} from "../src/index.ts";

const fixture = JSON.parse(
  await readFile(new URL("./fixtures/jupiter-markets.json", import.meta.url), "utf8"),
);
const NOW = Date.UTC(2026, 8, 14, 0, 0, 0);

test("normalizes Jupiter prices and timestamps into fixed-point units", () => {
  const market = normalizeJupiterMarket({ ...fixture.data[0].markets[0], eventId: fixture.data[0].eventId }, NOW);
  assert.equal(market.providerMarketId, "jup-sol-250-friday");
  assert.equal(market.yesBidE6, 550_000);
  assert.equal(market.yesAskE6, 580_000);
  assert.equal(market.closeTime, 1_790_208_000_000);
  assert.equal(market.volumeUsdE6, 24_137_520_000n);
});

test("calls the Jupiter endpoint with authentication and normalizes the list", async () => {
  let request: { url: string; key: string | null } | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    request = { url: String(input), key: headers.get("x-api-key") };
    return Response.json(fixture);
  };
  const source = new JupiterPredictionSource({ apiKey: "test-key", fetchImpl, now: () => NOW });
  const markets = await source.listMarkets({ status: "open", limit: 20 });
  assert.equal(markets.length, 2);
  assert.match(request?.url ?? "", /\/events\?includeMarkets=true&filter=live&start=0&end=20$/);
  assert.equal(request?.key, "test-key");
});

test("fails closed when live credentials are absent", () => {
  assert.throws(() => new JupiterPredictionSource({ apiKey: "" }), /JUPITER_API_KEY/);
});

test("catalog admits a sound market and records exact rejection reasons", () => {
  const markets = fixture.data.flatMap((event: { eventId: string; markets: unknown[] }) =>
    event.markets.map((market) => normalizeJupiterMarket({ ...(market as object), eventId: event.eventId }, NOW)),
  );
  const catalog = buildCatalog(markets, NOW);
  const healthy = catalog.find((entry) => entry.market.providerMarketId === "jup-sol-250-friday");
  const weak = catalog.find((entry) => entry.market.providerMarketId === "jup-stale-market");
  assert.equal(healthy?.eligibility.eligible, true);
  assert.deepEqual(weak?.eligibility.reasons, ["missing-rules", "spread-too-wide", "volume-too-low"]);
});

test("derives executable asks from the complementary orderbook", async () => {
  const source = new JupiterPredictionSource({
    apiKey: "test-key",
    now: () => NOW,
    fetchImpl: async () => Response.json({
      yes_dollars: [["0.55", "100"], ["0.50", "20"]],
      no_dollars: [["0.42", "90"]],
      yes: [],
      no: [],
    }),
  });
  const book = await source.getOrderbook("market-1");
  assert.equal(book.yesBidE6, 550_000);
  assert.equal(book.yesAskE6, 580_000);
  assert.equal(book.noAskE6, 450_000);
});

test("makes Jupiter's missing public trade tape explicit", async () => {
  const source = new JupiterPredictionSource({ apiKey: "test-key" });
  await assert.rejects(() => source.getTrades("market-1"), UnsupportedProviderCapabilityError);
});

test("rejects malformed provider data instead of silently defaulting identity", () => {
  assert.throws(() => normalizeJupiterMarket({ marketId: "x" }, NOW), /missing/);
});
