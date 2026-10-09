import { ComputeBudgetProgram, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { createPortfolioInstruction, depositInstruction, tradeInstruction, withdrawInstruction, type MoxieInstruction } from "../../../packages/sdk/src/instructions";
import type { ApiPortfolio, ApiPosition } from "./api";

// Pure helpers for building Moxie transactions and sizing orders. No React, no network.

/** Execution settings for the configured market group (from server env, passed to client components). */
export type ExecutionConfig = {
  cluster: string;
  percolatorProgramId: string;
  marketAccount: string;
  usdcMint: string;
  collateralVault: string;
  lpPortfolio: string;
  matcherProgramId: string;
  matcherContext: string;
  matcherDelegate: string;
  portfolioAccountSize: number;
  maxLeverage: number;
};

export type Side = "long" | "short";

const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

/** Trading fee charged on notional (matches the fee_bps sent with every trade). */
export const FEE_BPS = 30n;
const FEE_RATE = Number(FEE_BPS) / 10_000;
/** Extra margin Moxie reserves per contract for binary jump risk (MOXIE_BINARY_RISK_BUFFER_E6). */
const BINARY_RISK_BUFFER = 0.05;
/** Price protection: the order fails rather than filling worse than quote ± this many E6. */
export const SLIPPAGE_E6 = 20_000n;
/** Headroom kept unspent so an order never fails on margin rounding or a small price move. */
const SAFETY = 0.97;

export function isConfigured(config: ExecutionConfig): boolean {
  const { cluster: _cluster, maxLeverage: _max, portfolioAccountSize: _size, ...addresses } = config;
  return Object.values(addresses).every(Boolean);
}

export function toInstruction(x: MoxieInstruction): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(x.programAddress),
    keys: x.accounts.map((a) => ({ pubkey: new PublicKey(a.address), isSigner: a.isSigner, isWritable: a.isWritable })),
    data: Buffer.from(x.data),
  });
}

export function associatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([owner.toBytes(), TOKEN_PROGRAM.toBytes(), mint.toBytes()], ATA_PROGRAM)[0];
}

export function ownerHex(address: string): string {
  return Array.from(new PublicKey(address).toBytes(), (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- Margin and sizing ----------

/** Initial margin (USD) one contract needs at price p (0–1), per Moxie's directional binary notional. */
export function marginPerContract(side: Side, price: number, leverage = 1): number {
  const adverse = side === "long" ? price + BINARY_RISK_BUFFER : Math.max(1 - price + BINARY_RISK_BUFFER, price);
  return Math.min(adverse, 1 + BINARY_RISK_BUFFER) / leverage;
}

export type OrderPlan = {
  contracts: number;
  sizeQ: bigint;
  notionalUsd: number;
  marginUsd: number;
  feeUsd: number;
  /** What the position pays if the event resolves in its favour (long → YES, short → NO). */
  maxPayoutUsd: number;
};

/** Sizes an order so margin + fee fit inside `amountUsd`. */
export function planOrder(side: Side, amountUsd: number, priceCents: number, leverage = 1): OrderPlan | null {
  const price = priceCents / 100;
  if (!(amountUsd > 0) || !(price > 0 && price < 1)) return null;
  const costPerContract = marginPerContract(side, price, leverage) + price * FEE_RATE;
  const contractsRaw = (amountUsd * SAFETY) / costPerContract;
  const sizeQ = BigInt(Math.floor(contractsRaw * 1_000_000));
  if (sizeQ <= 0n) return null;
  const count = Number(sizeQ) / 1_000_000;
  return {
    contracts: count,
    sizeQ: side === "long" ? sizeQ : -sizeQ,
    notionalUsd: count * price,
    marginUsd: count * marginPerContract(side, price, leverage),
    feeUsd: count * price * FEE_RATE,
    maxPayoutUsd: count,
  };
}

/** Collateral not committed to open positions, in USD. */
export function freeCollateralUsd(portfolio: ApiPortfolio): number {
  const capital = Number(portfolio.capital) / 1_000_000;
  if (!portfolio.health.valid) return Math.max(capital, 0);
  const equity = Number(portfolio.health.equity) / 1_000_000;
  const initial = Number(portfolio.health.initialRequirement) / 1_000_000;
  // A freshly funded portfolio may not have a certified equity yet.
  const base = equity > 0 ? equity : capital;
  return Math.max(base - initial, 0);
}

/** Estimated unrealized PnL of a position at the current mark (cents), in USD. */
export function positionPnlUsd(position: ApiPosition, markCents: number): number {
  const size = Math.abs(Number(position.sizeQ)) / 1_000_000;
  const value = size * (markCents / 100);
  const entry = Number(position.entryNotional) / 1_000_000;
  return position.side === "long" ? value - entry : entry - value;
}

/** Average entry price of a position, in cents. */
export function entryPriceCents(position: ApiPosition): number | null {
  const size = Math.abs(Number(position.sizeQ)) / 1_000_000;
  if (!size) return null;
  return (Number(position.entryNotional) / 1_000_000 / size) * 100;
}

// ---------- Matcher quote ----------

const u32 = (v: DataView, o: number) => BigInt(v.getUint32(o, true));
const u128 = (v: DataView, o: number) => v.getBigUint64(o, true) | (v.getBigUint64(o + 8, true) << 64n);
const i128 = (v: DataView, o: number) => {
  const x = u128(v, o);
  return x & (1n << 127n) ? x - (1n << 128n) : x;
};

export class MatcherCapacityError extends Error {
  constructor() {
    super("This order is larger than the liquidity provider can fill right now. Try a smaller size.");
    this.name = "MatcherCapacityError";
  }
}

/**
 * Replicates the Moxie matcher's quote for `requestedQ` (positive = buy) around the oracle mark (E6).
 * Throws MatcherCapacityError when the matcher would refuse the size.
 */
export function quoteMatcher(data: Uint8Array, oracleE6: bigint, requestedQ: bigint): bigint {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const s = 64;
  if (data.length !== 320 || data[s + 8] !== 0) throw new Error("The liquidity provider is paused.");
  const baseSpread = u32(v, s + 48);
  const maxAdjust = u32(v, s + 52);
  const sizeCoefficient = u32(v, s + 56);
  const skewCoefficient = u32(v, s + 60);
  const charges = u32(v, s + 64) + u32(v, s + 68) + u32(v, s + 144) + u32(v, s + 148);
  const epsilon = u32(v, s + 152);
  const maxFill = u128(v, s + 96);
  const capacity = u128(v, s + 112);
  const inventory = i128(v, s + 128);
  const abs = requestedQ < 0n ? -requestedQ : requestedQ;
  const nextInventory = inventory - requestedQ;
  if (abs > maxFill || (nextInventory < 0n ? -nextInventory : nextInventory) > capacity) throw new MatcherCapacityError();
  const inventoryAdjustment = ((-inventory * 2n + requestedQ) * skewCoefficient) / (capacity * 2n);
  const sizeAdjustment = (abs * sizeCoefficient + capacity - 1n) / capacity;
  const raw = inventoryAdjustment + (baseSpread + charges + sizeAdjustment) * (requestedQ > 0n ? 1n : -1n);
  const bounded = raw < -maxAdjust ? -maxAdjust : raw > maxAdjust ? maxAdjust : raw;
  const price = oracleE6 + bounded;
  const upper = 1_000_000n - epsilon;
  return price < epsilon ? epsilon : price > upper ? upper : price;
}

export function limitFor(quoteE6: bigint, sizeQ: bigint): bigint {
  const limit = sizeQ > 0n ? quoteE6 + SLIPPAGE_E6 : quoteE6 - SLIPPAGE_E6;
  return limit < 1n ? 1n : limit > 999_999n ? 999_999n : limit;
}

// ---------- Transactions ----------

const computeBudget = () => [ComputeBudgetProgram.requestHeapFrame({ bytes: 128 * 1024 }), ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })];

export function createPortfolioTx(config: ExecutionConfig, owner: PublicKey, portfolio: PublicKey, rentLamports: number): Transaction {
  return new Transaction().add(
    SystemProgram.createAccount({ fromPubkey: owner, newAccountPubkey: portfolio, lamports: rentLamports, space: config.portfolioAccountSize, programId: new PublicKey(config.percolatorProgramId) }),
    toInstruction(createPortfolioInstruction({ program: config.percolatorProgramId, owner: owner.toBase58(), market: config.marketAccount, portfolio: portfolio.toBase58() })),
  );
}

export function depositTx(config: ExecutionConfig, owner: PublicKey, portfolio: ApiPortfolio, amountAtoms: bigint): Transaction {
  const source = associatedTokenAddress(owner, new PublicKey(config.usdcMint));
  return new Transaction().add(
    toInstruction(
      depositInstruction({
        program: config.percolatorProgramId,
        owner: owner.toBase58(),
        market: config.marketAccount,
        portfolio: portfolio.address,
        sourceToken: source.toBase58(),
        vault: config.collateralVault,
        tokenProgram: TOKEN_PROGRAM.toBase58(),
        portfolioId: BigInt(portfolio.portfolioId),
        sequence: BigInt(portfolio.sequence),
        amount: amountAtoms,
      }),
    ),
  );
}

export function withdrawTx(config: ExecutionConfig, owner: PublicKey, portfolio: ApiPortfolio, amountAtoms: bigint): Transaction {
  const destination = associatedTokenAddress(owner, new PublicKey(config.usdcMint));
  const [vaultAuthority] = PublicKey.findProgramAddressSync([Buffer.from("vault"), new PublicKey(config.marketAccount).toBytes()], new PublicKey(config.percolatorProgramId));
  return new Transaction().add(
    ...computeBudget(),
    toInstruction(
      withdrawInstruction({
        program: config.percolatorProgramId,
        owner: owner.toBase58(),
        market: config.marketAccount,
        portfolio: portfolio.address,
        destinationToken: destination.toBase58(),
        vault: config.collateralVault,
        vaultAuthority: vaultAuthority.toBase58(),
        tokenProgram: TOKEN_PROGRAM.toBase58(),
        portfolioId: BigInt(portfolio.portfolioId),
        sequence: BigInt(portfolio.sequence),
        amount: amountAtoms,
      }),
    ),
  );
}

export function tradeTx(
  config: ExecutionConfig,
  owner: PublicKey,
  trader: ApiPortfolio,
  lp: ApiPortfolio,
  market: { assetIndex: number; marketId: string },
  sizeQ: bigint,
  limitE6: bigint,
): Transaction {
  return new Transaction().add(
    ...computeBudget(),
    toInstruction(
      tradeInstruction({
        program: config.percolatorProgramId,
        traderAuthority: owner.toBase58(),
        market: config.marketAccount,
        traderPortfolio: trader.address,
        lpPortfolio: config.lpPortfolio,
        matcherProgram: config.matcherProgramId,
        matcherContext: config.matcherContext,
        matcherDelegate: config.matcherDelegate,
        traderPortfolioId: BigInt(trader.portfolioId),
        traderPositionEpoch: BigInt(trader.positionEpoch),
        lpPortfolioId: BigInt(lp.portfolioId),
        lpPositionEpoch: BigInt(lp.positionEpoch),
        lpMatcherSequence: BigInt(lp.sequence),
        assetIndex: market.assetIndex,
        marketId: BigInt(market.marketId),
        sizeQ,
        feeBps: FEE_BPS,
        limitPriceE6: limitE6,
      }),
    ),
  );
}
