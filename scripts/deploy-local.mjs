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

run("solana", ["--url", "localhost", "cluster-version"]);
run("solana", ["program", "deploy", "--url", "localhost", "--program-id",
  "vendor/percolator-prog/target/deploy/percolator_prog-keypair.json",
  "vendor/percolator-prog/target/deploy/percolator_prog.so"]);
run("solana", ["program", "deploy", "--url", "localhost", "--program-id",
  "programs/moxie-matcher/target/deploy/moxie_matcher-keypair.json",
  "programs/moxie-matcher/target/deploy/moxie_matcher.so"]);
run("solana", ["program", "deploy", "--url", "localhost", "--program-id",
  "programs/moxie-oracle/target/deploy/moxie_oracle-keypair.json",
  "programs/moxie-oracle/target/deploy/moxie_oracle.so"]);
const solanaConfig = execFileSync("solana", ["config", "get"], { encoding: "utf8" });
const payerPath = solanaConfig.match(/^Keypair Path:\s+(.+)$/m)?.[1]?.trim();
if (!payerPath) throw new Error("could not resolve Keypair Path from `solana config get`");
const bootstrapArgs = ["run", "--quiet", "--manifest-path", "tools/moxie-bootstrap/Cargo.toml", "--",
  "http://127.0.0.1:8899",
  "vendor/percolator-prog/target/deploy/percolator_prog-keypair.json",
  "programs/moxie-matcher/target/deploy/moxie_matcher-keypair.json",
  "programs/moxie-oracle/target/deploy/moxie_oracle-keypair.json",
  "config/percolator.market-group.json",
  "deployments/localnet.local.json",
  payerPath];
if (process.argv.includes("--live")) bootstrapArgs.push("deployments/jupiter-live-market.json");
run("cargo", bootstrapArgs);
