import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PantaPredictionSource } from "../../../packages/provider-adapter/src/index.ts";
import { createIndexerApi } from "./api.ts";
import { MoxieIndexer, type MarketMetadata } from "./indexer.ts";
import { loadSnapshot, saveSnapshot } from "./persistence.ts";
import { PantaCatalogService } from "./provider-catalog.ts";
import { SolanaRpcSource } from "./rpc-source.ts";

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const metadataPath = process.env.MARKET_METADATA_PATH ?? "config/tradable-markets.json";
let metadata: MarketMetadata[] = [];
try {
  metadata = JSON.parse(await readFile(metadataPath, "utf8"));
} catch (error: any) {
  if (error?.code !== "ENOENT") throw error;
}

const source = new SolanaRpcSource(
  process.env.SOLANA_RPC_URL ?? "http://127.0.0.1:8899",
  required("MOXIE_ORACLE_PROGRAM_ID"),
  required("PERCOLATOR_PROGRAM_ID"),
);
const indexer = new MoxieIndexer(source, undefined, metadata);
const snapshot = process.env.INDEXER_SNAPSHOT ?? ".data/moxie-index.json";
await loadSnapshot(indexer.store, snapshot);
const metadataByMarketId = new Map(metadata.map((entry) => [entry.providerMarketId, entry]));
for (const market of indexer.store.markets.values()) {
  const entry = metadataByMarketId.get(market.providerMarketId);
  indexer.store.upsertMarket({
    ...market,
    provider: entry?.provider?.toLowerCase() ?? market.provider ?? "unknown",
  });
}

const pantaKey = process.env.PANTA_API_LIVE_KEY ?? process.env.PANTA_API_KEY;
const panta = pantaKey
  ? new PantaCatalogService(
      new PantaPredictionSource({
        apiKey: pantaKey,
        baseUrl:
          process.env.PANTA_LIVE_API_BASE_URL ??
          process.env.PANTA_API_BASE_URL ??
          "https://live-api.panta.market/api/v1",
      }),
    )
  : undefined;

const refreshPantaMetadata = async () => {
  if (!panta) return;
  await panta.refresh();
  const markets = await panta.markets({ limit: 250 });
  for (const market of markets) {
    const hash = createHash("sha256").update(market.providerMarketId).digest("hex");
    const frozen = indexer.metadata.get(hash);
    indexer.metadata.set(hash, {
      provider: "panta",
      providerMarketId: market.providerMarketId,
      title: market.title,
      // Resolution rules are identity-bound at activation. Provider refreshes
      // may enrich display data but must never replace the frozen rule text.
      rules: frozen?.rules ?? market.rules,
    });
  }
  for (const projected of indexer.store.markets.values()) {
    const entry = indexer.metadata.get(projected.providerMarketId);
    if (!entry) continue;
    indexer.store.upsertMarket({
      ...projected,
      provider: entry.provider ?? "unknown",
      providerMarketId: entry.providerMarketId,
      title: entry.title,
      rules: entry.rules ?? projected.rules,
    });
  }
};

const port = Number(process.env.PORT ?? "8787");
createIndexerApi(indexer.store, panta).listen(port, () =>
  console.log(`Moxie indexer API listening on :${port}`),
);

let syncing = false;
const sync = async () => {
  if (syncing) return;
  syncing = true;
  try {
    await indexer.sync();
    await saveSnapshot(indexer.store, snapshot);
  } catch (error) {
    console.error("indexer sync failed; serving the last saved snapshot and retrying", error);
  } finally {
    syncing = false;
  }
};

void sync();
if (panta) {
  void refreshPantaMetadata().catch((error) =>
    console.error("initial Panta refresh failed; the catalog will retry on request", error),
  );
}

const interval = Number(process.env.INDEXER_POLL_MS ?? "5000");
setInterval(() => void sync(), interval).unref();
