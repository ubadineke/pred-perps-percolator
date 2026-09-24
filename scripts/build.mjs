import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.execPath,
  ["--experimental-strip-types", "--check", "packages/provider-adapter/src/index.ts"],
  { stdio: "inherit" },
);

if (result.status !== 0) process.exit(result.status ?? 1);

const configResult = spawnSync(
  process.execPath,
  ["--experimental-strip-types", "--check", "packages/config/src/market-group.ts"],
  { stdio: "inherit" },
);

if (configResult.status !== 0) process.exit(configResult.status ?? 1);

const catalogResult = spawnSync(
  process.execPath,
  ["--experimental-strip-types", "--check", "packages/market-catalog/src/catalog-store.ts"],
  { stdio: "inherit" },
);

if (catalogResult.status !== 0) process.exit(catalogResult.status ?? 1);

for (const file of [
  "packages/sdk/src/imported-market.ts",
  "services/oracle-reporter/src/reference.ts",
  "services/resolution-reporter/src/resolution.ts",
  "services/keeper/src/planner.ts",
  "packages/sdk/src/percolator.ts",
  "packages/sdk/src/accounts.ts",
  "packages/sdk/src/index.ts",
  "packages/sdk/src/instructions.ts",
  "services/indexer/src/store.ts",
  "services/indexer/src/indexer.ts",
  "services/indexer/src/api.ts",
  "services/indexer/src/rpc-source.ts",
  "services/indexer/src/persistence.ts",
  "services/indexer/src/server.ts",
]) {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
