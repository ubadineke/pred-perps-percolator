import { mkdir, writeFile } from "node:fs/promises";
import { JupiterPredictionSource } from "../packages/provider-adapter/src/jupiter.ts";

const wanted = Math.max(1, Math.min(Number(process.argv[2] ?? 3), 8));
const baseUrl = process.env.JUPITER_PREDICTION_BASE_URL ?? "https://api.jup.ag/prediction/v1";
const source = new JupiterPredictionSource({ baseUrl });
const markets = await source.listMarkets({ status: "open", limit: 50 });
const candidates = markets
  .filter((m) => m.status === "open" && m.closeTime > Date.now() + 60 * 60_000)
  .filter((m) => m.yesBidE6 > 0 && m.yesAskE6 < 1_000_000 && m.yesAskE6 > m.yesBidE6)
  .sort((a, b) => (a.yesAskE6 - a.yesBidE6) - (b.yesAskE6 - b.yesBidE6));

const selected = [];
const usedEvents = new Set();
for (const candidate of candidates) {
  if (selected.length >= wanted || usedEvents.has(candidate.providerEventId)) continue;
  const response = await fetch(`${baseUrl}/events/${candidate.providerEventId}`, {
    headers: { "x-api-key": process.env.JUPITER_API_KEY, accept: "application/json" },
  });
  if (!response.ok) continue;
  const event = await response.json();
  const raw = event.markets?.find((m) => m.marketId === candidate.providerMarketId);
  if (!raw?.rulesPrimary || !Array.isArray(raw.clobTokenIds) || raw.clobTokenIds.length < 2) continue;
  const book = await source.getOrderbook(candidate.providerMarketId).catch(() => null);
  if (!book?.yesBids.length || !book?.noBids.length) continue;
  selected.push({
    fetchedAt: new Date().toISOString(), provider: "jupiter", underlyingProvider: raw.provider,
    providerEventId: candidate.providerEventId, providerMarketId: candidate.providerMarketId,
    title: `${event.metadata?.title ?? candidate.providerEventId} — ${candidate.title}`,
    rules: [raw.rulesPrimary, raw.rulesSecondary].filter(Boolean).join("\n\n"),
    yesAssetId: raw.clobTokenIds[0], noAssetId: raw.clobTokenIds[1], closeTimeMs: candidate.closeTime,
    initialMarkE6: Math.round((book.yesBidE6 + book.yesAskE6) / 2),
    book: { yesBidE6: book.yesBidE6, yesAskE6: book.yesAskE6, noBidE6: book.noBidE6, noAskE6: book.noAskE6 },
  });
  usedEvents.add(candidate.providerEventId);
}
if (selected.length < wanted) throw new Error(`only ${selected.length} Jupiter markets passed activation checks (wanted ${wanted})`);
await mkdir("deployments", { recursive: true });
for (const [index, market] of selected.entries()) {
  await writeFile(`deployments/jupiter-live-market-${index + 1}.json`, `${JSON.stringify(market, null, 2)}\n`);
  console.log(`${index + 1}. ${market.providerMarketId} ${market.title} @ ${market.initialMarkE6 / 1e6}`);
}
