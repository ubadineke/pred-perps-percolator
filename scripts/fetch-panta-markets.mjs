import { mkdir, writeFile } from "node:fs/promises";
import { PantaPredictionSource } from "../packages/provider-adapter/src/panta.ts";

const wanted = Math.max(1, Math.min(Number(process.argv[2] ?? 3), 8));
const apiKey = process.env.PANTA_API_LIVE_KEY ?? process.env.PANTA_API_KEY;
// Candidate manifests must come from the live catalog. PANTA_API_BASE_URL may
// intentionally point at staging for isolated adapter tests.
const baseUrl = process.env.PANTA_LIVE_API_BASE_URL ?? "https://live-api.panta.market/api/v1";
const source = new PantaPredictionSource({ apiKey, baseUrl });
const now = Date.now();
const summaries = [];
let cursor;

for (let pageIndex = 0; pageIndex < 5 && summaries.length < 100; pageIndex += 1) {
  const page = await source.listMarketPage({ cursor, limit: 20 });
  summaries.push(...page.markets);
  cursor = page.nextCursor;
  if (!cursor) break;
}

const openSummaries = summaries
  .filter((market) => market.status === "open" && market.closeTime > now + 60 * 60_000)
  .sort((a, b) => (b.volumeUsdE6 ?? 0n) > (a.volumeUsdE6 ?? 0n) ? 1 : -1);

// The live list endpoint is a catalog and does not carry probability. The
// documented detail endpoint is RPC-backed and provides the admission price.
const eligible = [];
for (const summary of openSummaries) {
  const market = await source.getMarket(summary.providerMarketId).catch(() => summary);
  if (market.indexPriceE6 === undefined || market.indexPriceE6 <= 0 || market.indexPriceE6 >= 1_000_000) continue;
  eligible.push(market);
}

const selected = [];
for (const summary of eligible) {
  if (selected.length >= wanted) break;
  const market = summary;
  if (market.indexPriceE6 === undefined || !market.rules.trim()) continue;
  selected.push({
    fetchedAt: new Date().toISOString(),
    provider: "panta",
    underlyingProvider: "panta",
    sourceNetwork: market.sourceNetwork,
    providerProgramId: market.providerProgramId,
    providerEventId: market.providerMarketId,
    providerMarketId: market.providerMarketId,
    title: market.title,
    rules: market.rules,
    yesAssetId: market.yesAssetId,
    noAssetId: market.noAssetId,
    closeTimeMs: market.closeTime,
    initialMarkE6: market.indexPriceE6,
    sourceUrl: market.sourceUrl,
    admission: {
      status: "candidate",
      priceKind: "reference-index",
      executableBookVerified: false,
      note: "Requires Moxie market admission and local liquidity before trading is enabled.",
    },
  });
}

if (selected.length < wanted) {
  const counts = {
    fetched: summaries.length,
    open: summaries.filter((market) => market.status === "open").length,
    future: summaries.filter((market) => market.closeTime > now + 60 * 60_000).length,
    priced: eligible.length,
  };
  const phases = [...new Set(summaries.map((market) => `${market.status}:${market.providerPhase ?? "none"}`))];
  const latestClose = summaries.reduce((latest, market) => Math.max(latest, market.closeTime), 0);
  throw new Error(`only ${selected.length} Panta markets passed candidate checks (wanted ${wanted}); ${JSON.stringify({ ...counts, phases, latestClose: latestClose ? new Date(latestClose).toISOString() : null })}`);
}
await mkdir("deployments", { recursive: true });
for (const [index, market] of selected.entries()) {
  const path = `deployments/panta-live-market-${index + 1}.json`;
  await writeFile(path, `${JSON.stringify(market, null, 2)}\n`);
  console.log(`${index + 1}. ${market.providerMarketId} ${market.title} @ ${market.initialMarkE6 / 1e6} -> ${path}`);
}
