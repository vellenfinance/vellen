import { test } from "node:test";
import assert from "node:assert/strict";
import { band, crosses, gapPpm, meanTick, priceFromSqrt, sqrtPriceAtTick, to1e18 } from "./math";

test("gap of the PK example: 1.05 vs 1.00 = +5 %", () => {
  assert.equal(gapPpm(105n * 10n ** 16n, 10n ** 18n), 50_000n);
  assert.equal(gapPpm(95n * 10n ** 16n, 10n ** 18n), -50_000n);
  assert.equal(gapPpm(1n, 3n), -666_666n);
  assert.throws(() => gapPpm(1n, 0n));
});

test("threshold boundaries match the contract", () => {
  assert.equal(crosses(1, 500, 50_000n), true);
  assert.equal(crosses(1, 500, 49_999n), false);
  assert.equal(crosses(2, 500, -50_000n), true);
  assert.equal(crosses(3, 500, -50_000n), true);
  assert.equal(crosses(3, 500, 0n), false);
  assert.equal(crosses(9, 1, 10n ** 9n), false);
});

test("tick math known values", () => {
  assert.equal(sqrtPriceAtTick(0), 1n << 96n);
  assert.equal(sqrtPriceAtTick(-887272), 4295128739n);
  assert.equal(sqrtPriceAtTick(887272), 1461446703485210103287273052203988822378723970342n);
  assert.throws(() => sqrtPriceAtTick(887273));
});

test("mean tick rounds toward negative infinity", () => {
  assert.equal(meanTick(0n, -7n, 2), -4);
  assert.equal(meanTick(0n, 7n, 2), 3);
  assert.equal(meanTick(0n, -6n, 2), -3);
});

test("live CRCL/USDG pool reading (19 Nov 2026, slot0 of 0x654E…95a8, token0 = USDG) gives ~54 USDG", () => {
  const p = priceFromSqrt(10798832931675563669287514799079424n, false, 18, 6);
  const usd = Number(p) / 1e18;
  assert.ok(usd > 50 && usd < 60, String(usd));
});

test("scaling and band", () => {
  assert.equal(to1e18(969_552n, 6), 969_552n * 10n ** 12n);
  const b = band(10n ** 18n, 100);
  assert.equal(b.low, 99n * 10n ** 16n);
  assert.equal(b.high, 101n * 10n ** 16n);
});
