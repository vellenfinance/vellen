/*
 * Whole-history log scan, newest blocks first, in windows the node accepts. Pure: the caller passes the read function,
 * so the rules are unit tested without a chain.
 *
 * Lessons from earlier Robinhood Chain projects, kept here as rules:
 *   - the official RPC refuses a query spanning more than 10,000,000 blocks, so windows never exceed that;
 *   - a refusal about the size of the answer splits the window in half, down to a single block; a single block that is
 *     still refused becomes a numbered gap and the scan moves on (only a proven size refusal may be skipped);
 *   - a rate limit or an outage is never skipped: after one retry the scan stops and the whole unread range is a gap;
 *   - a call budget bounds the work; an unread rest is a gap too.
 * Every result says exactly which blocks were read and which were not.
 */

export type ReadErr = { kind: "too-large" } | { kind: "failed"; message: string };
export type Reader<L> = (from: number, to: number) => Promise<{ ok: true; logs: L[] } | { ok: false; error: ReadErr }>;

export type ScanResult<L> = {
  logs: L[];
  fromBlock: number;
  toBlock: number;
  gaps: [number, number][];
  calls: number;
  /** True when a rate limit or an outage stopped the scan early. */
  stopped: boolean;
};

export const MAX_SPAN = 10_000_000;

export async function scanBack<L>(read: Reader<L>, fromBlock: number, toBlock: number, opts: { maxCalls?: number; span?: number; retryDelayMs?: number } = {}): Promise<ScanResult<L>> {
  const span = Math.min(opts.span ?? MAX_SPAN, MAX_SPAN);
  const maxCalls = opts.maxCalls ?? 60;
  const delay = opts.retryDelayMs ?? 2_000;
  const logs: L[] = [];
  const gaps: [number, number][] = [];
  let calls = 0;
  let stopped = false;
  // Pending windows, processed newest first.
  const stack: [number, number][] = [];
  for (let hi = toBlock; hi >= fromBlock; hi -= span) stack.push([Math.max(fromBlock, hi - span + 1), hi]);
  stack.reverse(); // pop() takes the newest
  while (stack.length) {
    const [lo, hi] = stack.pop()!;
    if (calls >= maxCalls) {
      gaps.push([lo, hi]);
      continue;
    }
    calls++;
    let r = await read(lo, hi);
    if (!r.ok && r.error.kind === "failed") {
      await new Promise((res) => setTimeout(res, delay));
      calls++;
      r = await read(lo, hi);
    }
    if (r.ok) {
      logs.push(...r.logs);
      continue;
    }
    if (r.error.kind === "too-large") {
      if (hi === lo) {
        gaps.push([lo, hi]);
        continue;
      }
      const mid = lo + Math.floor((hi - lo) / 2);
      // Older half first in the stack so the newer half is read next.
      stack.push([lo, mid], [mid + 1, hi]);
      continue;
    }
    // Rate limit or outage: stop, never skip past it.
    stopped = true;
    gaps.push([lo, hi]);
    while (stack.length) gaps.push(stack.pop()!);
  }
  gaps.sort((a, b) => b[0] - a[0]);
  return { logs, fromBlock, toBlock, gaps: mergeGaps(gaps), calls, stopped };
}

/** Joins touching gap ranges; newest first. */
export function mergeGaps(gaps: [number, number][]): [number, number][] {
  const asc = [...gaps].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const g of asc) {
    const last = out[out.length - 1];
    if (last && g[0] <= last[1] + 1) last[1] = Math.max(last[1], g[1]);
    else out.push([g[0], g[1]]);
  }
  return out.reverse();
}

export const blocksMissing = (gaps: [number, number][]) => gaps.reduce((n, [a, b]) => n + (b - a + 1), 0);
