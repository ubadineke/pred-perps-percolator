import { mkdir, writeFile } from "node:fs/promises";
import { JupiterPredictionSource } from "../packages/provider-adapter/src/jupiter.ts";

const source = new JupiterPredictionSource();
const markets = await source.listMarkets({
  ...(process.env.JUPITER_MARKET_CATEGORY ? { category: process.env.JUPITER_MARKET_CATEGORY } : {}),
  status: "open",
  limit: 20,
});
const candidates = markets
  .filter((market) => market.status === "open")
  .filter((market) => market.closeTime > Date.now() + 15 * 60_000)
  .filter((market) => market.yesBidE6 > 0 && market.yesAskE6 < 1_000_000 && market.yesAskE6 > market.yesBidE6)
  .sort((left, right) => (left.yesAskE6 - left.yesBidE6) - (right.yesAskE6 - right.yesBidE6));

let selected;
let orderbook;
for (const candidate of candidates) {
  const eventResponse = await fetch(
    `${process.env.JUPITER_PREDICTION_BASE_URL ?? "https://api.jup.ag/prediction/v1"}/events/${candidate.providerEventId}`,
    { headers: { "x-api-key": process.env.JUPITER_API_KEY, accept: "application/json" } },
  );
  if (!eventResponse.ok) continue;
  const event = await eventResponse.json();
  const rawMarket = event.markets?.find((market) => market.marketId === candidate.providerMarketId);
  if (!rawMarket?.rulesPrimary || !Array.isArray(rawMarket.clobTokenIds) || rawMarket.clobTokenIds.length < 2) continue;
  const detailed = await source.getOrderbook(candidate.providerMarketId);
  if (!detailed.yesBids.length || !detailed.noBids.length) continue;
  selected = { candidate, event, rawMarket };
  orderbook = detailed;
  break;
}

if (!selected) throw new Error("no open Jupiter market passed identity, rules, timing, and two-sided-book checks");
const { candidate, event, rawMarket } = selected;
const initialMarkE6 = Math.round((orderbook.yesBidE6 + orderbook.yesAskE6) / 2);
const manifest = {
  fetchedAt: new Date().toISOString(),
  provider: "jupiter",
  underlyingProvider: rawMarket.provider,
  providerEventId: candidate.providerEventId,
  providerMarketId: candidate.providerMarketId,
  title: `${event.metadata?.title ?? candidate.providerEventId} — ${candidate.title}`,
  rules: [rawMarket.rulesPrimary, rawMarket.rulesSecondary].filter(Boolean).join("\n\n"),
  yesAssetId: rawMarket.clobTokenIds[0],
  noAssetId: rawMarket.clobTokenIds[1],
  closeTimeMs: candidate.closeTime,
  initialMarkE6,
  book: {
    yesBidE6: orderbook.yesBidE6,
    yesAskE6: orderbook.yesAskE6,
    noBidE6: orderbook.noBidE6,
    noAskE6: orderbook.noAskE6,
  },
};

await mkdir("deployments", { recursive: true });
await writeFile("deployments/jupiter-live-market.json", `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`ok Jupiter market ${manifest.providerMarketId}`);
console.log(`   ${manifest.title}`);
console.log(`   YES ${manifest.book.yesBidE6 / 1e6} / ${manifest.book.yesAskE6 / 1e6}`);
console.log(`   activation mark ${manifest.initialMarkE6 / 1e6}`);
console.log("   wrote deployments/jupiter-live-market.json");
