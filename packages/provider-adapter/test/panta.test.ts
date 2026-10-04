import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  normalizePantaMarket,
  PantaPredictionSource,
  PantaUnsupportedCapabilityError,
} from "../src/index.ts";

const fixture = JSON.parse(await readFile(new URL("./fixtures/panta-markets.json", import.meta.url), "utf8"));
const NOW = Date.UTC(2026, 8, 29, 12, 0, 0);

test("normalizes Panta point prices without fabricating an executable book", () => {
  const market = normalizePantaMarket({
    ...fixture.items[0],
    title: "Will a female housemate win Big Brother Naija Season 11?",
    resolutionRule: "Resolve YES if a female housemate wins.",
    sources: ["ng-pop-africamagic"],
    programId: "6gM5afTQBq5VZCfgpGqcsqzfWd5maLSCKWtGjbEobZMp",
  }, NOW);
  assert.equal(market.provider, "panta");
  assert.equal(market.indexPriceE6, 516_485);
  assert.equal(market.yesBidE6, undefined);
  assert.equal(market.yesAskE6, undefined);
  assert.equal(market.volumeUsdE6, 232_704_615n);
  assert.equal(market.closeTime, 1_791_151_200_000);
  assert.equal(market.sourceNetwork, "solana-mainnet");
  assert.match(market.rules, /ng-pop-africamagic/);
});

test("uses description when Panta list responses omit the title", () => {
  const market = normalizePantaMarket(fixture.items[0], NOW);
  assert.equal(market.title, fixture.items[0].description);
});

test("calls Panta with X-Api-Key and preserves the cursor", async () => {
  let request: { url: string; key: string | null } | undefined;
  const source = new PantaPredictionSource({
    apiKey: "pk_live_test",
    now: () => NOW,
    fetchImpl: async (input, init) => {
      const headers = new Headers(init?.headers);
      request = { url: String(input), key: headers.get("X-Api-Key") };
      return Response.json(fixture);
    },
  });
  const page = await source.listMarketPage({ limit: 20, cursor: "before" });
  assert.equal(page.markets.length, 1);
  assert.equal(page.nextCursor, "next-page");
  assert.match(request?.url ?? "", /markets\/\?cursor=before&limit=20$/);
  assert.equal(request?.key, "pk_live_test");
});

test("loads and normalizes the production Panta event feed", async () => {
  const liveEvent = {
    id: "event-row-id",
    eventPda: "5cyMGUVDcToJ8ws5V1sKkGnzthLrLTsqEjo3Pa2HNU8v",
    title: "France will concede in the first 25 minutes against Belgium.",
    Category: "sports",
    status: "open",
    startTime: "2026-10-05T18:45:00.000Z",
    endTime: "2026-10-05T19:15:00.000Z",
    resolutionTime: "2026-10-05T19:15:00.000Z",
    oracle: "https://www.fifa.com,https://www.uefa.com",
    programId: "6gM5afTQBq5VZCfgpGqcsqzfWd5maLSCKWtGjbEobZMp",
  };
  let requested = "";
  const source = new PantaPredictionSource({
    apiKey: "pk_live_test",
    baseUrl: "https://production-api.balr.fun/api/v1",
    now: () => NOW,
    fetchImpl: async (input) => {
      requested = String(input);
      return Response.json({ success: true, data: [liveEvent] });
    },
  });
  const [market] = await source.listMarkets({ status: "open", limit: 10 });
  assert.equal(requested, "https://production-api.balr.fun/api/v1/events");
  assert.equal(market.providerMarketId, liveEvent.eventPda);
  assert.equal(market.category, "sports");
  assert.equal(market.closeTime, Date.parse(liveEvent.endTime));
  assert.match(market.rules, /fifa\.com/);
  assert.equal(market.indexPriceE6, undefined);
});

test("Panta source fails closed without credentials", () => {
  assert.throws(() => new PantaPredictionSource({ apiKey: "" }), /PANTA_API_KEY/);
});

test("Panta orderbook capability is explicit rather than synthesized", async () => {
  const source = new PantaPredictionSource({ apiKey: "pk_live_test" });
  await assert.rejects(() => source.getOrderbook("market"), PantaUnsupportedCapabilityError);
});

test("rejects non-complementary Panta probabilities as an index", () => {
  const market = normalizePantaMarket({ ...fixture.items[0], yesPrice: "0.70", noPrice: "0.40" }, NOW);
  assert.equal(market.indexPriceE6, undefined);
});

test("skips malformed catalog summaries without weakening detail validation", async () => {
  const valid = JSON.parse(await readFile(new URL("./fixtures/panta-markets.json", import.meta.url), "utf8")).items[0];
  const source = new PantaPredictionSource({
    apiKey: "test",
    fetchImpl: async () => new Response(JSON.stringify({ items: [{ marketId: "broken" }, valid] }), { status: 200 }),
  });
  const page = await source.listMarketPage();
  assert.equal(page.markets.length, 1);
  assert.equal(page.markets[0].providerMarketId, valid.marketId);
});

test("derives a resolved outcome only from explicit or terminal provider data", () => {
  const base = fixture.items[0];
  assert.equal(normalizePantaMarket({ ...base, resolved: true, status: "resolved", yesPrice: "1", noPrice: "0" }, NOW).result, "YES");
  assert.equal(normalizePantaMarket({ ...base, resolved: true, status: "resolved", yesPrice: "0", noPrice: "1" }, NOW).result, "NO");
  assert.equal(normalizePantaMarket({ ...base, resolved: true, status: "resolved", yesPrice: "0.5", noPrice: "0.5" }, NOW).result, null);
});
