import { allowPublic, tooMany } from "@/lib/guard";
import { fail, ok } from "@/lib/server/respond";
import { gapSnapshot } from "@/lib/server/gap";
import { readHistory, type GapHistory } from "@/lib/server/gaphistory";
import { getStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/* Proven history (mint/redeem executions vs NAV, block-sampled NAV and basket). Heavy: one refresh at a time, kept 10 minutes. */
let cache: { at: number; value: GapHistory } | null = null;
let flying: Promise<GapHistory> | null = null;

export async function GET(request: Request) {
  if (!(await allowPublic(getStore(), request, "gaphist", 20, 300))) return tooMany();
  if (cache && Date.now() - cache.at < 600_000) return ok({ ...cache.value, servedAgeMs: Date.now() - cache.at }, 60);
  const snap = await gapSnapshot();
  if (!snap) return fail(new Error("unreachable"));
  flying ??= readHistory(snap.value).finally(() => {
    flying = null;
  });
  try {
    const value = await flying;
    // Only a complete scan is kept; a partial one is served once and read again next time.
    if (value.gaps.length === 0 && value.archive) cache = { at: Date.now(), value };
    return ok({ ...value, servedAgeMs: 0 }, 60);
  } catch (e) {
    if (cache) return ok({ ...cache.value, servedAgeMs: Date.now() - cache.at }, 60);
    return fail(e);
  }
}
