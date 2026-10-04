import { execFileSync, spawnSync } from "node:child_process";
import { accessSync, constants } from "node:fs";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

for (const path of [
  "vendor/percolator-prog/target/deploy/percolator_prog.so",
  "vendor/percolator-prog/target/deploy/percolator_prog-keypair.json",
  "programs/moxie-matcher/target/deploy/moxie_matcher.so",
  "programs/moxie-matcher/target/deploy/moxie_matcher-keypair.json",
  "programs/moxie-oracle/target/deploy/moxie_oracle.so",
  "programs/moxie-oracle/target/deploy/moxie_oracle-keypair.json",
]) accessSync(path, constants.R_OK);

const devnet = process.argv.includes("--devnet");
const rpcUrl = devnet
  ? process.env.DEVNET_RPC_URL ?? "https://api.devnet.solana.com"
  : "http://127.0.0.1:8899";
const deploymentPath = devnet
  ? "deployments/devnet.local.json"
  : "deployments/localnet.local.json";
const solanaConfig = execFileSync("solana", ["config", "get"], { encoding: "utf8" });
const configuredPayerPath = solanaConfig.match(/^Keypair Path:\s+(.+)$/m)?.[1]?.trim();
const payerPath = process.env.SOLANA_KEYPAIR_PATH?.trim() || configuredPayerPath;
if (!payerPath) throw new Error("could not resolve a payer keypair path");
accessSync(payerPath, constants.R_OK);

if (devnet) {
  const genesisHash = execFileSync("solana", ["genesis-hash", "--url", rpcUrl], { encoding: "utf8" }).trim();
  if (genesisHash !== "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG") {
    throw new Error(`refusing devnet deployment: unexpected genesis hash ${genesisHash}`);
  }
  const balance = execFileSync("solana", ["balance", "--url", rpcUrl, "--keypair", payerPath], { encoding: "utf8" }).trim();
  console.log(`devnet payer balance: ${balance}`);
}

run("solana", ["--url", rpcUrl, "cluster-version"]);
const deployTransportArgs = devnet ? ["--use-rpc"] : [];
run("solana", ["program", "deploy", "--url", rpcUrl, "--keypair", payerPath, ...deployTransportArgs, "--program-id",
  "vendor/percolator-prog/target/deploy/percolator_prog-keypair.json",
  "vendor/percolator-prog/target/deploy/percolator_prog.so"]);
run("solana", ["program", "deploy", "--url", rpcUrl, "--keypair", payerPath, ...deployTransportArgs, "--program-id",
  "programs/moxie-matcher/target/deploy/moxie_matcher-keypair.json",
  "programs/moxie-matcher/target/deploy/moxie_matcher.so"]);
run("solana", ["program", "deploy", "--url", rpcUrl, "--keypair", payerPath, ...deployTransportArgs, "--program-id",
  "programs/moxie-oracle/target/deploy/moxie_oracle-keypair.json",
  "programs/moxie-oracle/target/deploy/moxie_oracle.so"]);
const bootstrapArgs = ["run", "--quiet", "--manifest-path", "tools/moxie-bootstrap/Cargo.toml", "--",
  rpcUrl,
  "vendor/percolator-prog/target/deploy/percolator_prog-keypair.json",
  "programs/moxie-matcher/target/deploy/moxie_matcher-keypair.json",
  "programs/moxie-oracle/target/deploy/moxie_oracle-keypair.json",
  "config/percolator.market-group.json",
  deploymentPath,
  payerPath];
if (process.argv.includes("--live")) bootstrapArgs.push("deployments/jupiter-live-market.json");
run("cargo", bootstrapArgs);
