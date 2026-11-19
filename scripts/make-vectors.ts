/*
 * Parity vectors: computes cases with the site's math (src/lib/gap/math.ts) and writes them to
 * contracts/test/fixtures/vectors.json. VellenParity.t.sol replays every case against VellenGapMath.
 * Deterministic (seeded), so the file only changes when the math changes.
 */
import { writeFileSync } from "node:fs";
import { crosses, gapPpm, meanTick, priceFromSqrt, sqrtPriceAtTick } from "../src/lib/gap/math";

let seed = 0x5eed_1234n;
const rnd = () => {
  seed = (seed * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n);
  return seed;
};
const rint = (lo: number, hi: number) => lo + Number(rnd() % BigInt(hi - lo + 1));

const ticks: string[] = [], sqrts: string[] = [];
for (const t of [-887272, -1, 0, 1, 887272, -276325, 236464, -227095]) {
  ticks.push(String(t));
  sqrts.push(sqrtPriceAtTick(t).toString());
}
for (let i = 0; i < 120; i++) {
  const t = rint(-887272, 887272);
  ticks.push(String(t));
  sqrts.push(sqrtPriceAtTick(t).toString());
}

const pTicks: string[] = [], pBase0: boolean[] = [], pBaseDec: string[] = [], pQuoteDec: string[] = [], prices: string[] = [];
for (let i = 0; i < 120; i++) {
  const t = rint(-400000, 400000);
  const b0 = rnd() % 2n === 0n;
  const bd = [6, 8, 18][rint(0, 2)], qd = [6, 18][rint(0, 1)];
  pTicks.push(String(t)); pBase0.push(b0); pBaseDec.push(String(bd)); pQuoteDec.push(String(qd));
  prices.push(priceFromSqrt(sqrtPriceAtTick(t), b0, bd, qd).toString());
}

const gPrice: string[] = [], gNav: string[] = [], gaps: string[] = [], dirs: string[] = [], bps: string[] = [], hits: boolean[] = [];
for (let i = 0; i < 150; i++) {
  const nav = BigInt(rint(1, 2_000_000)) * 10n ** 12n + BigInt(rint(0, 999));
  const price = (nav * BigInt(rint(500_000, 1_500_000))) / 1_000_000n + BigInt(rint(0, 7));
  const g = gapPpm(price, nav);
  const d = rint(1, 3), b = rint(1, 5000);
  gPrice.push(price.toString()); gNav.push(nav.toString()); gaps.push(g.toString()); dirs.push(String(d)); bps.push(String(b)); hits.push(crosses(d, b, g));
}

const mStart: string[] = [], mEnd: string[] = [], mWin: string[] = [], means: string[] = [];
for (let i = 0; i < 60; i++) {
  const w = rint(60, 86400);
  const s = BigInt(rint(-2_000_000_000, 2_000_000_000)) * 1000n;
  const e = s + BigInt(rint(-887272, 887272)) * BigInt(w) + BigInt(rint(-5000, 5000));
  mStart.push(s.toString()); mEnd.push(e.toString()); mWin.push(String(w)); means.push(String(meanTick(s, e, w)));
}

writeFileSync(
  new URL("../contracts/test/fixtures/vectors.json", import.meta.url),
  JSON.stringify({ ticks, sqrts, pTicks, pBase0, pBaseDec, pQuoteDec, prices, gPrice, gNav, gaps, dirs, bps, hits, mStart, mEnd, mWin, means }, null, 0),
);
console.log("vectors:", ticks.length + prices.length + gaps.length + means.length);
