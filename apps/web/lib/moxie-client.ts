import { ComputeBudgetProgram, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { createPortfolioInstruction, depositInstruction, tradeInstruction, withdrawInstruction, type MoxieInstruction } from "../../../packages/sdk/src/instructions";
import { FEE_BPS } from "../../../packages/sdk/src/trading";
import type { ApiPortfolio, ApiPosition } from "./api";

// Sizing and quoting live in the SDK so integrators get the same behaviour as the web app.
export { FEE_BPS, MatcherCapacityError, SLIPPAGE_E6, limitFor, marginPerContract, planOrder, quoteMatcher, type OrderPlan, type Side } from "../../../packages/sdk/src/trading";

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

const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

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

// ---------- Portfolio math ----------

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

/** Average entry price of a position, in cents, or null when the indexer couldn't derive it. */
export function entryPriceCents(position: ApiPosition): number | null {
  return position.entryPriceE6 === null || position.entryPriceE6 === undefined ? null : Number(position.entryPriceE6) / 10_000;
}

/** Estimated unrealized PnL at the current mark (cents), in USD, before fees and funding. Null without an entry price. */
export function positionPnlUsd(position: ApiPosition, markCents: number): number | null {
  const entry = entryPriceCents(position);
  if (entry === null) return null;
  const signedContracts = Number(position.sizeQ) / 1_000_000;
  return (signedContracts * (markCents - entry)) / 100;
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
