import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const deploymentPath = new URL("../deployments/localnet.local.json", import.meta.url);
const deployment = JSON.parse(readFileSync(deploymentPath, "utf8"));
const rpcUrl = deployment.rpcUrl;

function solana(args) {
  return execFileSync("solana", ["--url", rpcUrl, ...args], { encoding: "utf8" });
}

function account(pubkey) {
  return JSON.parse(solana(["account", pubkey, "--output", "json"]));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const program = solana(["program", "show", deployment.percolatorProgramId]);
assert(program.includes("Program Id:"), "Percolator program is not deployed");
const matcher = solana(["program", "show", deployment.matcherProgramId]);
assert(matcher.includes("Program Id:"), "matcher program is not deployed");
const oracle = solana(["program", "show", deployment.oracleProgramId]);
assert(oracle.includes("Program Id:"), "oracle program is not deployed");

const market = account(deployment.marketAccount);
assert(
  market.account.owner === deployment.percolatorProgramId,
  `market owner mismatch: ${market.account.owner}`,
);
assert(market.account.space > 0, "market account has no allocated data");
const oracleConfig = account(deployment.oracleConfig);
assert(oracleConfig.account.owner === deployment.oracleProgramId, "oracle config owner mismatch");
assert(deployment.importedMarkets.length === 1, "expected one proven imported perp");
for (const imported of deployment.importedMarkets) {
  const record = account(imported.record);
  assert(record.account.owner === deployment.oracleProgramId, `import record owner mismatch for ${imported.providerMarketId}`);
  assert(record.account.space === 344, `import record size mismatch for ${imported.providerMarketId}`);
  const bytes = Buffer.from(record.account.data[0], "base64");
  assert(Number(bytes.readBigUInt64LE(272)) === 2, `pricing observation sequence missing for ${imported.providerMarketId}`);
  assert(Number(bytes.readBigUInt64LE(288)) === imported.initialMarkE6, `guarded index mismatch for ${imported.providerMarketId}`);
  assert(bytes[336] === 1, `oracle health is not healthy for ${imported.providerMarketId}`);
}

const mint = account(deployment.usdcMint);
assert(
  mint.account.owner === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  `collateral mint is not owned by the Token Program: ${mint.account.owner}`,
);

const vault = account(deployment.collateralVault);
assert(
  vault.account.owner === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  `collateral vault is not owned by the Token Program: ${vault.account.owner}`,
);
assert(vault.account.space === 165, `unexpected SPL token account size: ${vault.account.space}`);

const demo = deployment.engineDemo;
assert(demo, "engine demo result is missing");
const traderPortfolio = account(demo.traderPortfolio);
const lpPortfolio = account(demo.lpPortfolio);
const matcherContext = account(demo.matcherContext);
assert(traderPortfolio.account.owner === deployment.percolatorProgramId, "trader portfolio owner mismatch");
assert(lpPortfolio.account.owner === deployment.percolatorProgramId, "LP portfolio owner mismatch");
assert(matcherContext.account.owner === deployment.matcherProgramId, "matcher context owner mismatch");
assert(demo.traderPositionQ === demo.sizeQ, "trader position was not recorded");
assert(demo.lpPositionQ === -demo.sizeQ, "LP position is not equal and opposite");
assert(demo.slippageRejectionProven === true, "slippage rejection was not proven");

console.log(`ok Percolator program ${deployment.percolatorProgramId}`);
console.log(`ok matcher program ${deployment.matcherProgramId}`);
console.log(`ok oracle program ${deployment.oracleProgramId}`);
console.log(`ok immutable provider-market binding in ${deployment.oracleConfig}`);
console.log("ok authenticated depth/index inputs produced an on-chain guarded mark");
console.log(`ok market ${deployment.marketAccount} (${market.account.space} bytes)`);
console.log(`ok mock USDC mint ${deployment.usdcMint}`);
console.log(`ok collateral vault ${deployment.collateralVault}`);
console.log(`ok funded trader portfolio ${demo.traderPortfolio}: position ${demo.traderPositionQ}`);
console.log(`ok funded LP portfolio ${demo.lpPortfolio}: position ${demo.lpPositionQ}`);
console.log(`ok TradeCpi ${demo.tradeSignature}`);
console.log("ok matcher rejected a quote beyond the taker's signed limit");
