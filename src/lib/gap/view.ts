/* Display helpers shared by the home page and the Gap Watch. Values arrive as bigint strings scaled to 1e18. */

export const e18 = (v: string | null | undefined): number | null => (v == null ? null : Number(BigInt(v)) / 1e18);

export function money(v: number | null, digits = 4) {
  if (v === null || !Number.isFinite(v)) return "—";
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

/** ppm (string or number) -> "+0.38 %". */
export function pct(ppm: string | number | null | undefined, digits = 2) {
  if (ppm == null) return "—";
  const v = Number(ppm) / 10_000;
  if (!Number.isFinite(v)) return "—";
  const s = v.toFixed(digits);
  return `${v > 0 ? "+" : ""}${s === "-0.00" ? "0.00" : s} %`;
}

export function gapWord(ppm: string | number | null | undefined) {
  if (ppm == null) return "";
  const v = Number(ppm);
  if (v > 0) return "premium";
  if (v < 0) return "discount";
  return "at NAV";
}

/** Seconds -> "4 min", "2 h 10 min", "3 days". */
export function span(sec: number) {
  const s = Math.max(0, Math.round(sec));
  if (s < 90) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) {
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  const d = s / 86400;
  return `${d < 10 ? d.toFixed(1) : Math.round(d)} days`;
}

export const ageOf = (unix: number | null | undefined, now: number) => (unix ? span(now - unix) : "—");

export function utc(unix: number | null | undefined) {
  if (!unix) return "—";
  return new Date(unix * 1000).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export function units(raw: string, decimals: number, digits = 6) {
  const n = Number(BigInt(raw)) / 10 ** decimals;
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}
