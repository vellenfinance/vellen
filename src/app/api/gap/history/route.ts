import { allowPublic, tooMany } from "@/lib/guard";
import { fail, ok } from "@/lib/server/respond";
import { gapSnapshot } from "@/lib/server/gap";
import { readHistory, type GapHistory } from "@/lib/server/gaphistory";
import { getStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/* Proven history (mint/redeem executions vs NAV, block-sampled NAV and basket). Heavy: one refresh at a time, kept 10 minutes (partial readings 2 minutes). */
let cache: { at: number; value: GapHistory; complete: boolean } | null = null;
let flying: Promise<GapHistory> | null = null;

export async function GET(request: Request) {
  if (!(await allowPublic(getStore(), request, "gaphist", 20, 300))) return tooMany();
  if (cache && Date.now() - cache.at < (cache.complete ? 600_000 : 120_000)) return ok({ ...cache.value, servedAgeMs: Date.now() - cache.at }, 60);
  const snap = await gapSnapshot();
  if (!snap) return fail(new Error("unreachable"));
  flying ??= readHistory(snap.value).finally(() => {
    flying = null;
  });
  try {
    const value = await flying;
    // A complete reading is kept 10 minutes; a partial one only 2 minutes (so a busy archive endpoint is not asked again at once),
    // and never replaces a complete one that is still fresh.
    const complete = value.gaps.length === 0 && value.archive;
    if (complete || !cache?.complete || Date.now() - cache.at > 600_000) cache = { at: Date.now(), value, complete };
    return ok({ ...value, servedAgeMs: 0 }, 60);
  } catch (e) {
    if (cache) return ok({ ...cache.value, servedAgeMs: Date.now() - cache.at }, 60);
    return fail(e);
  }
}
