import assert from "node:assert/strict";
import test from "node:test";
import { MatcherCapacityError, SLIPPAGE_E6, limitFor, marginPerContract, planOrder, quoteMatcher } from "../src/trading.ts";

test("margin follows the directional binary notional", () => {
  // Long at 50¢: price + 5¢ buffer.
  assert.equal(marginPerContract("long", 0.5), 0.55);
  // Short at 30¢: complement + buffer (75¢).
  assert.equal(Number(marginPerContract("short", 0.3).toFixed(4)), 0.75);
  // Short at 90¢: never below the price itself.
  assert.equal(marginPerContract("short", 0.9), 0.9);
});

test("planOrder keeps margin + fee inside the amount and signs shorts negative", () => {
  const long = planOrder("long", 100, 50);
  assert.ok(long);
  assert.ok(long.marginUsd + long.feeUsd <= 100);
  assert.ok(long.sizeQ > 0n);
  assert.equal(long.maxPayoutUsd, long.contracts);
  const short = planOrder("short", 100, 50);
  assert.ok(short && short.sizeQ < 0n);
  assert.equal(planOrder("long", 0, 50), null);
  assert.equal(planOrder("long", 10, 100), null);
});

// Minimal 320-byte matcher context: config block at offset 64.
function matcher({ maxFill, capacity, inventory = 0n }: { maxFill: bigint; capacity: bigint; inventory?: bigint }) {
  const data = new Uint8Array(320);
  const v = new DataView(data.buffer);
  const s = 64;
  v.setUint32(s + 48, 3_000, true); // base spread
  v.setUint32(s + 52, 100_000, true); // max adjustment
  v.setUint32(s + 56, 10_000, true); // size coefficient
  v.setUint32(s + 60, 80_000, true); // skew coefficient
  v.setUint32(s + 152, 1_000, true); // epsilon
  const u128 = (o: number, x: bigint) => {
    const n = x < 0n ? (1n << 128n) + x : x;
    v.setBigUint64(o, n & ((1n << 64n) - 1n), true);
    v.setBigUint64(o + 8, n >> 64n, true);
  };
  u128(s + 96, maxFill);
  u128(s + 112, capacity);
  u128(s + 128, inventory);
  return data;
}

test("quoteMatcher prices buys above and sells below the mark", () => {
  const data = matcher({ maxFill: 10_000_000n, capacity: 100_000_000n });
  assert.ok(quoteMatcher(data, 500_000n, 1_000_000n) > 500_000n);
  assert.ok(quoteMatcher(data, 500_000n, -1_000_000n) < 500_000n);
});

test("quoteMatcher refuses sizes above the per-fill limit", () => {
  const data = matcher({ maxFill: 10_000_000n, capacity: 100_000_000n });
  assert.throws(() => quoteMatcher(data, 500_000n, 20_000_000n), MatcherCapacityError);
});

test("limitFor applies slippage against the trader and clamps to (0, 1)", () => {
  assert.equal(limitFor(500_000n, 1n), 500_000n + SLIPPAGE_E6);
  assert.equal(limitFor(500_000n, -1n), 500_000n - SLIPPAGE_E6);
  assert.equal(limitFor(999_000n, 1n), 999_999n);
  assert.equal(limitFor(5_000n, -1n), 1n);
});
