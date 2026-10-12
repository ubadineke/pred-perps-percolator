// Order sizing and quoting for Moxie binary markets. Pure functions, no network access.
//
// Units: probabilities are E6 integers (500_000 = 50¢) or plain 0–1 numbers where noted;
// sizes are q units (1_000_000 q = 1 contract); one contract pays $1 if its side wins.

/** Trading fee charged on notional, in basis points (sent as fee_bps with every trade). */
export const FEE_BPS = 30n;
const FEE_RATE = Number(FEE_BPS) / 10_000;

/** Extra margin reserved per contract for binary jump risk (Percolator MOXIE_BINARY_RISK_BUFFER_E6 = 50_000). */
export const BINARY_RISK_BUFFER = 0.05;

/** Default price protection: fail rather than fill more than 2¢ worse than the quote. */
export const SLIPPAGE_E6 = 20_000n;

/** Fraction of the requested amount actually committed, leaving headroom for rounding and small moves. */
const SIZING_SAFETY = 0.97;

export type Side = "long" | "short";

/**
 * Initial margin (USD) one contract needs at price `price` (0–1).
 * Mirrors Percolator's directional binary notional: a long can lose its price plus the buffer;
 * a short can lose the complement plus the buffer, but never less than the price itself.
 */
export function marginPerContract(side: Side, price: number, leverage = 1): number {
  const adverse = side === "long" ? price + BINARY_RISK_BUFFER : Math.max(1 - price + BINARY_RISK_BUFFER, price);
  return Math.min(adverse, 1 + BINARY_RISK_BUFFER) / leverage;
}

export type OrderPlan = {
  /** Contracts to trade (always positive). */
  contracts: number;
  /** Signed size for the trade instruction: positive = long, negative = short. */
  sizeQ: bigint;
  notionalUsd: number;
  marginUsd: number;
  feeUsd: number;
  /**
   * Position value if the price reaches its extreme in the position's favour (100¢ for a long,
   * 0¢ for a short): one dollar per contract. Positions still open at the hard-flat deadline are
   * closed at the protected mark, not at this value.
   */
  maxPayoutUsd: number;
};

/**
 * Sizes an order so its margin plus fee fit inside `amountUsd` of free collateral.
 * `priceCents` is the current price in cents (0–100). Returns null for non-positive amounts or prices.
 */
export function planOrder(side: Side, amountUsd: number, priceCents: number, leverage = 1): OrderPlan | null {
  const price = priceCents / 100;
  if (!(amountUsd > 0) || !(price > 0 && price < 1)) return null;
  const costPerContract = marginPerContract(side, price, leverage) + price * FEE_RATE;
  const sizeQ = BigInt(Math.floor(((amountUsd * SIZING_SAFETY) / costPerContract) * 1_000_000));
  if (sizeQ <= 0n) return null;
  const contracts = Number(sizeQ) / 1_000_000;
  return {
    contracts,
    sizeQ: side === "long" ? sizeQ : -sizeQ,
    notionalUsd: contracts * price,
    marginUsd: contracts * marginPerContract(side, price, leverage),
    feeUsd: contracts * price * FEE_RATE,
    maxPayoutUsd: contracts,
  };
}

/** Thrown when the matcher would refuse an order of this size (per-fill or inventory limit). */
export class MatcherCapacityError extends Error {
  constructor() {
    super("This order is larger than the liquidity provider can fill right now. Try a smaller size.");
    this.name = "MatcherCapacityError";
  }
}

const u32 = (v: DataView, o: number) => BigInt(v.getUint32(o, true));
const u128 = (v: DataView, o: number) => v.getBigUint64(o, true) | (v.getBigUint64(o + 8, true) << 64n);
const i128 = (v: DataView, o: number) => {
  const x = u128(v, o);
  return x & (1n << 127n) ? x - (1n << 128n) : x;
};

/**
 * Replicates the Moxie matcher's fill price for `requestedQ` (positive = buy) around the oracle
 * mark `oracleE6`, from the raw matcher context account data (320 bytes).
 * Throws MatcherCapacityError when the matcher would refuse the size.
 */
export function quoteMatcher(matcherContext: Uint8Array, oracleE6: bigint, requestedQ: bigint): bigint {
  const v = new DataView(matcherContext.buffer, matcherContext.byteOffset, matcherContext.byteLength);
  const s = 64;
  if (matcherContext.length !== 320 || matcherContext[s + 8] !== 0) throw new Error("The liquidity provider is paused.");
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

/** Limit price for an order: the quote plus `slippageE6` against the trader, clamped to (0, 1). */
export function limitFor(quoteE6: bigint, sizeQ: bigint, slippageE6 = SLIPPAGE_E6): bigint {
  const limit = sizeQ > 0n ? quoteE6 + slippageE6 : quoteE6 - slippageE6;
  return limit < 1n ? 1n : limit > 999_999n ? 999_999n : limit;
}
