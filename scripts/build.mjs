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
]) {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
