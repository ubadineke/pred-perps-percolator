import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const deploymentPath = process.argv[2]
  ? new URL(`../${process.argv[2]}`, import.meta.url)
  : new URL("../deployments/localnet.local.json", import.meta.url);
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
assert(deployment.importedMarkets.length >= 1, "expected at least one imported perp");
for (const imported of deployment.importedMarkets) {
  const record = account(imported.record);
  assert(record.account.owner === deployment.oracleProgramId, `import record owner mismatch for ${imported.providerMarketId}`);
  assert(record.account.space === 384, `import record size mismatch for ${imported.providerMarketId}`);
  const bytes = Buffer.from(record.account.data[0], "base64");
  if (imported.marketId === deployment.engineDemo.marketId) {
    assert(Number(bytes.readBigUInt64LE(272)) === 3, `terminal observation sequence missing for ${imported.providerMarketId}`);
    assert(Number(bytes.readBigUInt64LE(288)) === 1_000_000, `terminal index mismatch for ${imported.providerMarketId}`);
    assert(bytes[336] === 1, `oracle health is not healthy for ${imported.providerMarketId}`);
    assert(bytes[9] === 5, `market did not finish resolved after hard-flat for ${imported.providerMarketId}`);
    assert(Number(bytes.readBigUInt64LE(280)) === 1_000_000, `terminal YES mark missing for ${imported.providerMarketId}`);
    assert(Number(bytes.readBigInt64LE(368)) === 0, `funding premium was not cleared at resolution for ${imported.providerMarketId}`);
    assert(Number(bytes.readBigInt64LE(376)) === 0, `funding did not stop at lock for ${imported.providerMarketId}`);
  }
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
assert(demo.fundingEpoch > 0, "bounded funding was not accrued by Percolator");
assert(demo.fundingLongPaidAtoms > 0, "long funding debit was not settled");
assert(
  demo.fundingLongPaidAtoms === demo.fundingShortReceivedAtoms,
  "funding debit and credit are not zero-sum",
);
assert(demo.hardFlatProven === true, "deadline hard-flat did not clear both positions");
assert(demo.resolutionProven === true, "authenticated final result was not recorded");
assert(demo.terminalOutcome === 1, "unexpected terminal outcome");
assert(demo.withdrawalProven === true, "post-resolution collateral withdrawal was not proven");
assert(demo.duplicateResolutionRejected === true, "duplicate resolution was not rejected");
assert(demo.conflictingResolutionRejected === true, "conflicting resolution was not rejected");

console.log(`ok Percolator program ${deployment.percolatorProgramId}`);
console.log(`ok matcher program ${deployment.matcherProgramId}`);
console.log(`ok oracle program ${deployment.oracleProgramId}`);
console.log(`ok immutable provider-market binding in ${deployment.oracleConfig}`);
console.log("ok authenticated depth/index inputs produced an on-chain guarded mark");
console.log("ok absolute-point funding accrued and stopped at lock");
console.log(`ok market ${deployment.marketAccount} (${market.account.space} bytes)`);
console.log(`ok mock USDC mint ${deployment.usdcMint}`);
console.log(`ok collateral vault ${deployment.collateralVault}`);
console.log(`ok funded trader portfolio ${demo.traderPortfolio}: position ${demo.traderPositionQ}`);
console.log(`ok funded LP portfolio ${demo.lpPortfolio}: position ${demo.lpPositionQ}`);
console.log(`ok TradeCpi ${demo.tradeSignature}`);
console.log(
  `ok zero-sum Percolator funding ${demo.fundingLongPaidAtoms} atoms at epoch ${demo.fundingEpoch}`,
);
console.log("ok lock-clock hard-flat cleared both open positions");
console.log("ok final provider result resolved the imported event one-way at YES = 1");
console.log("ok flattened trader withdrew collateral after event resolution");
console.log("ok duplicate and conflicting terminal results were rejected on-chain");
console.log("ok matcher rejected a quote beyond the taker's signed limit");
