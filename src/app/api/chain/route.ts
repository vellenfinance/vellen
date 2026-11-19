import { NextResponse } from "next/server";
import { allowPublic, tooMany } from "@/lib/guard";
import { getStore } from "@/lib/server/store";
import { readSnapshot, type ChainSnapshot } from "@/lib/server/snapshot";

export const dynamic = "force-dynamic";

/* Live facts for the whole site. Cached for a few seconds and refreshed by one request at a time; the CDN may serve it for 10 s. */

let cache: { at: number; value: ChainSnapshot } | null = null;
const TTL = 8_000;
let inflight: Promise<void> | null = null;
let lastTry = 0;

export async function GET(request: Request) {
  if (!(await allowPublic(getStore(), request, "chain", 60, 1200))) return tooMany();
  if ((!cache || Date.now() - cache.at > TTL) && Date.now() - lastTry > TTL) {
    lastTry = Date.now();
    inflight ??= readSnapshot()
      .then((value) => {
        if (value.block !== null || !cache || Date.now() - cache.at > 120_000) cache = { at: Date.now(), value };
      })
      .catch(() => {})
      .finally(() => {
        inflight = null;
      });
  }
  if (inflight) await inflight;
  if (!cache) return NextResponse.json({ error: "Chain data is not available yet." }, { status: 503, headers: { "cache-control": "no-store" } });
  return NextResponse.json(cache.value, { headers: { "cache-control": "public, max-age=0, s-maxage=10, stale-while-revalidate=30" } });
}
