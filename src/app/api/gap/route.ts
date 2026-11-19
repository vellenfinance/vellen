import { allowPublic, tooMany } from "@/lib/guard";
import { fail, ok } from "@/lib/server/respond";
import { gapSnapshot } from "@/lib/server/gap";
import { getStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/* The live reading of the index: NAV, constituents, pools, basket gap, market search. Shared cache, 30 s fresh, ≤ 10 min stale. */
export async function GET(request: Request) {
  if (!(await allowPublic(getStore(), request, "gap", 60, 1200))) return tooMany();
  const r = await gapSnapshot();
  if (!r) return fail(new Error("unreachable"));
  return ok({ ...r.value, servedAgeMs: r.ageMs }, 15);
}
