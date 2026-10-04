import { execFileSync } from "node:child_process";
import { accessSync, constants, readFileSync } from "node:fs";
import { basename } from "node:path";

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const manifestPath = process.argv.slice(2).find((argument) => argument !== "--");
if (!manifestPath) throw new Error("usage: pnpm panta:bootstrap:devnet -- <candidate-manifest.json>");
accessSync(manifestPath, constants.R_OK);
const candidate = JSON.parse(readFileSync(manifestPath, "utf8"));
if (candidate.provider !== "panta") throw new Error("candidate manifest is not a Panta market");

const groupPath = process.env.MOXIE_DEVNET_GROUP_RECEIPT ?? "deployments/jupiter-market-group-devnet.local.json";
const group = JSON.parse(readFileSync(groupPath, "utf8"));
const rpc = process.env.DEVNET_RPC_URL ?? process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const payer = process.env.SOLANA_KEYPAIR_PATH ?? `${process.env.HOME}/.config/solana/id.json`;
const percolator = required("PERCOLATOR_PROGRAM_ID");
const matcher = required("MOXIE_MATCHER_PROGRAM_ID");
const oracle = required("MOXIE_ORACLE_PROGRAM_ID");
const stem = basename(manifestPath, ".json");
const importReceipt = `deployments/${stem}-devnet.local.json`;
const liquidityReceipt = `deployments/${stem}-liquidity-devnet.local.json`;

const cargo = (...args) => execFileSync("cargo", args, { stdio: "inherit" });
cargo(
  "run", "--quiet", "--manifest-path", "tools/moxie-bootstrap/Cargo.toml",
  "--bin", "import_market", "--",
  rpc, percolator, oracle, group.marketAccount, payer, manifestPath, importReceipt,
);

const imported = JSON.parse(readFileSync(importReceipt, "utf8"));
cargo(
  "run", "--quiet", "--manifest-path", "tools/moxie-bootstrap/Cargo.toml",
  "--bin", "seed_liquidity", "--",
  rpc, percolator, matcher, group.marketAccount, group.usdcMint,
  group.collateralVault, payer, String(imported.closeTime), liquidityReceipt,
);

console.log(`Panta market activated: ${importReceipt}`);
console.log(`Moxie liquidity seeded: ${liquidityReceipt}`);
