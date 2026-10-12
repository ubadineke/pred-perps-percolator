import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCloseResolvedData,
  buildCreatePortfolioData,
  buildDepositData,
  buildHardFlatData,
  buildPermissionlessCrankData,
  buildTradeCpiData,
  buildWithdrawData,
} from "../src/percolator.ts";

// Byte-exact layouts mirrored from the Percolator program's instruction decoder
// (vendor/percolator-prog/src/v16_program.rs). The program rejects trailing bytes, so the
// length must match exactly, and the tag selects the instruction.
const le = (value: bigint, bytes: number) => Array.from({ length: bytes }, (_, i) => Number((value >> BigInt(8 * i)) & 0xffn));
const i128 = (value: bigint) => le(value < 0n ? (1n << 128n) + value : value, 16);

test("InitPortfolio is the bare tag 1", () => {
  assert.deepEqual([...buildCreatePortfolioData()], [1]);
});

test("Deposit and Withdraw: tag + portfolio u64 + sequence u64 + amount u128", () => {
  assert.deepEqual([...buildDepositData(7n, 9n, 1_000_000n)], [3, ...le(7n, 8), ...le(9n, 8), ...le(1_000_000n, 16)]);
  assert.deepEqual([...buildWithdrawData(7n, 9n, 5n)], [4, ...le(7n, 8), ...le(9n, 8), ...le(5n, 16)]);
});

test("PermissionlessCrank: tag + now_slot u64 + count u8 + (asset u16, oracle_accounts u8)×n", () => {
  assert.deepEqual([...buildPermissionlessCrankData(0n, [1, 2])], [5, ...le(0n, 8), 2, ...le(1n, 2), 0, ...le(2n, 2), 0]);
});

test("TradeCpi: tag 10, exactly 85 bytes", () => {
  const data = buildTradeCpiData({
    traderPortfolioId: 1n, traderPositionEpoch: 2n, lpPortfolioId: 3n, lpPositionEpoch: 4n, lpMatcherSequence: 5n,
    assetIndex: 2, marketId: 7n, sizeQ: -1_000_000n, feeBps: 30n, limitPriceE6: 500_000n, backingFeeCapBps: 0,
  });
  assert.deepEqual([...data], [
    10, ...le(1n, 8), ...le(2n, 8), ...le(3n, 8), ...le(4n, 8), ...le(5n, 8),
    ...le(2n, 2), ...le(7n, 8), ...i128(-1_000_000n), ...le(30n, 8), ...le(500_000n, 8), ...le(0n, 2),
  ]);
});

test("CloseResolved: tag 30 + fee rate u128", () => {
  assert.deepEqual([...buildCloseResolvedData(3n)], [30, ...le(3n, 16)]);
});

test("MoxieHardFlat: tag 71 (not 69, RestartAssetOracle), exactly 59 bytes", () => {
  assert.deepEqual([...buildHardFlatData(1n, 2n, 3n, 4n, 5, 6n, 1_000_000n)], [
    71, ...le(1n, 8), ...le(2n, 8), ...le(3n, 8), ...le(4n, 8), ...le(5n, 2), ...le(6n, 8), ...le(1_000_000n, 16),
  ]);
});
