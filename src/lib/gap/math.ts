/*
 * The gap math, one-to-one with contracts/src/VellenGapMath.sol (parity vectors: contracts/test/fixtures/vectors.json,
 * replayed by VellenParity.t.sol). Prices are "asset units per one whole token, scaled to 1e18" as bigint.
 * gapPpm = (price - nav) * 1_000_000 / nav, truncated toward zero. 10_000 ppm = 1 % = 100 bps.
 */

export const PPM = 1_000_000n;
export const PPM_PER_BPS = 100n;
export const MIN_TICK = -887272;
export const MAX_TICK = 887272;

export type Direction = 1 | 2 | 3; // premium, discount, either
export const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: 1, label: "Premium (price above NAV)" },
  { value: 2, label: "Discount (price below NAV)" },
  { value: 3, label: "Either side" },
];

/** BigInt division already truncates toward zero, like Solidity. */
export function gapPpm(price: bigint, nav: bigint): bigint {
  if (nav === 0n) throw new Error("NAV is zero");
  return ((price - nav) * PPM) / nav;
}

/** Exactly at the threshold counts as crossed. */
export function crosses(direction: number, thresholdBps: number, gap: bigint): boolean {
  const t = BigInt(thresholdBps) * PPM_PER_BPS;
  if (direction === 1) return gap >= t;
  if (direction === 2) return gap <= -t;
  if (direction === 3) return gap >= t || gap <= -t;
  return false;
}

export function to1e18(amount: bigint, decimals: number): bigint {
  if (decimals > 36) throw new Error("decimals too large");
  if (decimals === 18) return amount;
  if (decimals < 18) return amount * 10n ** BigInt(18 - decimals);
  return amount / 10n ** BigInt(decimals - 18);
}

export const mulDiv = (a: bigint, b: bigint, d: bigint) => (a * b) / d;

const Q192 = 1n << 192n;
const Q128 = 1n << 128n;
const U128_MAX = (1n << 128n) - 1n;

/** Price of one whole base token in quote units (1e18) from a pool's Q64.96 sqrt price; same two branches as the contract. */
export function priceFromSqrt(sqrtPriceX96: bigint, baseIsToken0: boolean, baseDecimals: number, quoteDecimals: number): bigint {
  const base = 10n ** BigInt(baseDecimals);
  let quote: bigint;
  if (sqrtPriceX96 <= U128_MAX) {
    const r = sqrtPriceX96 * sqrtPriceX96;
    quote = baseIsToken0 ? mulDiv(r, base, Q192) : mulDiv(Q192, base, r);
  } else {
    const r = mulDiv(sqrtPriceX96, sqrtPriceX96, 1n << 64n);
    quote = baseIsToken0 ? mulDiv(r, base, Q128) : mulDiv(Q128, base, r);
  }
  return to1e18(quote, quoteDecimals);
}

/** Mean tick over a window, rounded toward negative infinity. */
export function meanTick(cumStart: bigint, cumEnd: bigint, secondsAgo: number): number {
  const delta = cumEnd - cumStart;
  const span = BigInt(secondsAgo);
  let t = delta / span;
  if (delta < 0n && delta % span !== 0n) t -= 1n;
  return Number(t);
}

const STEPS: [number, bigint][] = [
  [0x2, 0xfff97272373d413259a46990580e213an],
  [0x4, 0xfff2e50f5f656932ef12357cf3c7fdccn],
  [0x8, 0xffe5caca7e10e4e61c3624eaa0941cd0n],
  [0x10, 0xffcb9843d60f6159c9db58835c926644n],
  [0x20, 0xff973b41fa98c081472e6896dfb254c0n],
  [0x40, 0xff2ea16466c96a3843ec78b326b52861n],
  [0x80, 0xfe5dee046a99a2a811c461f1969c3053n],
  [0x100, 0xfcbe86c7900a88aedcffc83b479aa3a4n],
  [0x200, 0xf987a7253ac413176f2b074cf7815e54n],
  [0x400, 0xf3392b0822b70005940c7a398e4b70f3n],
  [0x800, 0xe7159475a2c29b7443b29c7fa6e889d9n],
  [0x1000, 0xd097f3bdfd2022b8845ad8f792aa5825n],
  [0x2000, 0xa9f746462d870fdf8a65dc1f90e061e5n],
  [0x4000, 0x70d869a156d2a1b890bb3df62baf32f7n],
  [0x8000, 0x31be135f97d08fd981231505542fcfa6n],
  [0x10000, 0x9aa508b5b7a84e1c677de54f3e99bc9n],
  [0x20000, 0x5d6af8dedb81196699c329225ee604n],
  [0x40000, 0x2216e584f5fa1ea926041bedfe98n],
  [0x80000, 0x48a170391f7dc42444e8fa2n],
];
const U256_MAX = (1n << 256n) - 1n;

export function sqrtPriceAtTick(tick: number): bigint {
  const abs = Math.abs(tick);
  if (!Number.isInteger(tick) || abs > MAX_TICK) throw new Error("tick out of range");
  let ratio = abs & 0x1 ? 0xfffcb933bd6fad37aa2d162d1a594001n : 0x100000000000000000000000000000000n;
  for (const [bit, k] of STEPS) if (abs & bit) ratio = (ratio * k) >> 128n;
  if (tick > 0) ratio = U256_MAX / ratio;
  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n);
}

/** Time-weighted price of `base` from two tick cumulatives (pool.observe([window, 0])). */
export function twapPrice(cumStart: bigint, cumEnd: bigint, window: number, baseIsToken0: boolean, baseDecimals: number, quoteDecimals: number) {
  const tick = meanTick(cumStart, cumEnd, window);
  return { tick, price: priceFromSqrt(sqrtPriceAtTick(tick), baseIsToken0, baseDecimals, quoteDecimals) };
}

/** Human helpers. */
export const e18ToNumber = (v: bigint) => Number(v) / 1e18;
export const ppmToPct = (v: bigint | number) => Number(v) / 10_000;

/** The band of prices that does not cross a ±threshold around NAV (both 1e18). */
export function band(nav: bigint, thresholdBps: number) {
  const d = (nav * BigInt(thresholdBps) * PPM_PER_BPS) / PPM;
  return { low: nav - d, high: nav + d };
}
