// Devnet keeper: keeps every listed event asset accrued to the live slot so risk-increasing
// trades are not rejected as loss-stale. TypeScript port of tools/moxie-bootstrap keeper_loop.
//
// Once an asset carries open interest, Percolator rejects risk-increasing trades while the
// asset's accrual trails the market clock, and each crank advances an asset by at most one
// bounded step. This loop performs that catch-up continuously.
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { decodePortfolioSummary } from "../../../packages/sdk/src/accounts.ts";
import { buildPermissionlessCrankData } from "../../../packages/sdk/src/percolator.ts";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const rpc = process.env.SOLANA_RPC_URL ?? process.env.DEVNET_RPC_URL ?? "https://api.devnet.solana.com";
const program = new PublicKey(required("PERCOLATOR_PROGRAM_ID"));
const market = new PublicKey(required("MOXIE_MARKET_ACCOUNT"));
const crankPortfolio = new PublicKey(required("KEEPER_CRANK_PORTFOLIO"));
const assets = (process.env.KEEPER_ASSETS ?? "1,2").split(",").map((value) => Number(value.trim()));
const keypairPath = process.env.SOLANA_KEYPAIR_PATH ?? `${homedir()}/.config/solana/id.json`;
const secret = JSON.parse(
  process.env.SOLANA_KEYPAIR?.trim() ||
    (await readFile(keypairPath, "utf8").catch(() => {
      throw new Error(`SOLANA_KEYPAIR is not set and no keypair file exists at ${keypairPath}`);
    })),
) as number[];
const payer = Keypair.fromSecretKey(Uint8Array.from(secret));
const connection = new Connection(rpc, "confirmed");

// Byte offsets inside the market-group account for this deployment (8 configured assets).
// The group's variable-length vectors come first, so these are fixed per market account;
// verified against tools/moxie-bootstrap inspect_market. Override if the market is redeployed.
const CURRENT_SLOT_OFFSET = Number(process.env.KEEPER_CURRENT_SLOT_OFFSET ?? 1045);
const ASSET_BASE_OFFSET = Number(process.env.KEEPER_ASSET_BASE_OFFSET ?? 1702); // asset 0 market_id
const ASSET_STRIDE = Number(process.env.KEEPER_ASSET_STRIDE ?? 1813);
const SLOT_LAST_IN_ASSET = 41; // slot_last sits 41 bytes after market_id
const u64 = (data: Buffer, offset: number) => data.readBigUInt64LE(offset);
const assetMarketId = (data: Buffer, asset: number) => u64(data, ASSET_BASE_OFFSET + ASSET_STRIDE * asset);
const assetSlotLast = (data: Buffer, asset: number) => u64(data, ASSET_BASE_OFFSET + ASSET_STRIDE * asset + SLOT_LAST_IN_ASSET);

const readMarket = async () => {
  const account = await connection.getAccountInfo(market, "confirmed");
  if (!account) throw new Error(`market ${market.toBase58()} not found`);
  return account.data;
};

// Refuse to run against a layout we don't recognise rather than crank blindly.
const initial = await readMarket();
for (const asset of assets) {
  if (assetMarketId(initial, asset) === 0n) {
    throw new Error(`asset ${asset} has no market id at the expected offset; check KEEPER_ASSET_* offsets`);
  }
}
const portfolioAccount = await connection.getAccountInfo(crankPortfolio, "confirmed");
if (!portfolioAccount) throw new Error(`crank portfolio ${crankPortfolio.toBase58()} not found`);
const portfolioOwner = new PublicKey(Buffer.from(decodePortfolioSummary(portfolioAccount.data).ownerHex, "hex"));

const crank = () =>
  new TransactionInstruction({
    programId: program,
    keys: [
      { pubkey: portfolioOwner, isSigner: false, isWritable: false },
      { pubkey: market, isSigner: false, isWritable: true },
      { pubkey: crankPortfolio, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(buildPermissionlessCrankData(0n, assets)),
  });

let lastCrankAt = 0;
let lastLag = 0;
if (process.env.PORT) {
  createServer((_, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ service: "keeper", payer: payer.publicKey.toBase58(), lastCrankAt, lastLag }));
  }).listen(Number(process.env.PORT), () => console.log(`keeper: health on :${process.env.PORT}`));
}

console.log(`keeper: market=${market.toBase58()} assets=${assets} crank_portfolio=${crankPortfolio.toBase58()} payer=${payer.publicKey.toBase58()}`);

// Accrual per crank varies (a flat-price segment advances up to max_accrual_dt_slots; an exposed
// asset's bounded path can advance far less), so learn it from observed progress.
let advancePerCrank = 16n;
// Cranks per transaction. Each crank touches every listed asset, so the compute cost grows with
// the asset count; start conservatively and adapt: halve on a compute-budget overrun, creep back
// up after clean batches.
const CRANK_CAP = Number(process.env.KEEPER_MAX_CRANKS ?? 8);
let maxCranks = Math.max(1, Math.min(CRANK_CAP, Math.floor(16 / Math.max(1, assets.length))));
let cleanBatches = 0;
let previous: { slowest: bigint; count: number } | undefined;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const tick = async () => {
  const [data, nowNumber] = await Promise.all([readMarket(), connection.getSlot("confirmed")]);
  const now = BigInt(nowNumber);
  const currentSlot = u64(data, CURRENT_SLOT_OFFSET);
  const slots = assets.map((asset) => assetSlotLast(data, asset));
  const slowest = slots.reduce((min, slot) => (slot < min ? slot : min), now);
  if (previous && slowest > previous.slowest && previous.count > 0) {
    const learned = (slowest - previous.slowest) / BigInt(previous.count);
    advancePerCrank = learned > 0n ? learned : 1n;
  }
  previous = undefined;
  const lag = now > slowest ? now - slowest : 0n;
  lastLag = Number(lag);
  const clockAhead = slots.some((slot) => slot < currentSlot);
  if (lag <= 8n && !clockAhead) return;
  // Leave ~one crank of headroom so the batch never reaches the live slot early
  // (a trailing no-op crank reverts the whole batch).
  const raw = Number(lag / advancePerCrank) - 1;
  const count = Math.min(maxCranks, Math.max(1, raw));
  if (process.env.KEEPER_DRY_RUN === "1") {
    console.log(`keeper (dry run): now=${now} current_slot=${currentSlot} slots=${slots} lag=${lag} would send ${count} cranks`);
    return;
  }
  const tx = new Transaction().add(
    ComputeBudgetProgram.requestHeapFrame({ bytes: 128 * 1024 }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
    ...Array.from({ length: count }, crank),
  );
  try {
    const signature = await connection.sendTransaction(tx, [payer]);
    await connection.confirmTransaction(signature, "confirmed");
    previous = { slowest, count };
    lastCrankAt = Date.now();
    if (count === maxCranks && ++cleanBatches >= 20 && maxCranks < CRANK_CAP) {
      maxCranks += 1;
      cleanBatches = 0;
    }
    console.log(`keeper: lag=${lag} cranks=${count} advance/crank=${advancePerCrank} sig=${signature.slice(0, 12)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // A crank with nothing left to do reverts the batch with Custom(22) = 0x16; shrink next time.
    if (/custom program error: 0x16\b|"Custom":22/.test(message)) advancePerCrank *= 2n;
    else if (/exceeded CUs meter|ComputationalBudgetExceeded|Program failed to complete/.test(message) && maxCranks > 1) {
      maxCranks = Math.max(1, Math.floor(maxCranks / 2));
      cleanBatches = 0;
      console.log(`keeper: compute budget exceeded; now ${maxCranks} crank(s) per transaction`);
    } else console.error(`keeper: crank failed (lag=${lag}): ${message}`);
  }
};

for (;;) {
  try {
    await tick();
  } catch (error) {
    console.error("keeper: tick error:", error instanceof Error ? error.message : error);
  }
  await sleep(2_000);
}
