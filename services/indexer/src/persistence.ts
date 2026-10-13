import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ProjectionStore } from "./store.ts";

/** Where the projection snapshot lives between restarts. */
export interface SnapshotStore {
  load(store: ProjectionStore): Promise<boolean>;
  save(store: ProjectionStore): Promise<void>;
}

/** Local JSON file (the default for development). */
export function fileSnapshotStore(path: string): SnapshotStore {
  let lastHash = "";
  return {
    async load(store) {
      try {
        store.restore(JSON.parse(await readFile(path, "utf8")));
        return true;
      } catch (e: any) {
        if (e?.code === "ENOENT") return false;
        throw e;
      }
    },
    async save(store) {
      const body = JSON.stringify(store.snapshot());
      const hash = createHash("sha256").update(body).digest("hex");
      if (hash === lastHash) return;
      await mkdir(dirname(path), { recursive: true });
      const temp = `${path}.${process.pid}.tmp`;
      await writeFile(temp, body, "utf8");
      await rename(temp, path);
      lastHash = hash;
    },
  };
}

/**
 * Postgres (for hosts without a persistent disk). The whole projection is one row; it is small
 * once keeper cranks are excluded, and the chain remains the source of truth.
 */
export async function postgresSnapshotStore(connectionString: string, key = "default"): Promise<SnapshotStore> {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({
    connectionString,
    max: 2,
    // Render's internal URL is plain TCP; external URLs need TLS.
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });
  await pool.query(
    "create table if not exists moxie_indexer_snapshot (key text primary key, data jsonb not null, updated_at timestamptz not null default now())",
  );
  let lastHash = "";
  let lastSavedAt = 0;
  let lastEventCount = -1;
  // Health and price points change every sync; write at most every SNAPSHOT_MIN_INTERVAL_MS
  // unless new events (fills, deposits, ...) arrived.
  const minInterval = Number(process.env.SNAPSHOT_MIN_INTERVAL_MS ?? 30_000);
  return {
    async load(store) {
      const { rows } = await pool.query("select data from moxie_indexer_snapshot where key = $1", [key]);
      if (!rows.length) return false;
      store.restore(rows[0].data);
      return true;
    },
    async save(store) {
      const eventCount = store.events.size;
      if (eventCount === lastEventCount && Date.now() - lastSavedAt < minInterval) return;
      const body = JSON.stringify(store.snapshot());
      const hash = createHash("sha256").update(body).digest("hex");
      if (hash === lastHash) return;
      await pool.query(
        "insert into moxie_indexer_snapshot (key, data, updated_at) values ($1, $2::jsonb, now()) on conflict (key) do update set data = excluded.data, updated_at = now()",
        [key, body],
      );
      lastHash = hash;
      lastSavedAt = Date.now();
      lastEventCount = eventCount;
    },
  };
}

// Kept for existing callers and tests.
export async function loadSnapshot(store: ProjectionStore, path: string) {
  return fileSnapshotStore(path).load(store);
}
export async function saveSnapshot(store: ProjectionStore, path: string) {
  return fileSnapshotStore(path).save(store);
}
