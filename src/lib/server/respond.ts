import "server-only";
import { NextResponse } from "next/server";

/* JSON answers for the read routes: bigints as decimal strings, CDN caching for 10 s (the owner pays per request). */

const replacer = (_: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v);

export function ok(value: unknown, sMaxAge = 10) {
  return new NextResponse(JSON.stringify(value, replacer), {
    headers: { "content-type": "application/json", "cache-control": `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=30` },
  });
}

export function fail(e: unknown, status = 503) {
  const m = e instanceof Error ? e.message : String(e ?? "");
  const text = /429|busy|too many/i.test(m) ? "The chain's RPC is busy. Try again in a minute." : "The chain could not be reached.";
  return NextResponse.json({ error: text }, { status, headers: { "cache-control": "no-store" } });
}

export const bad = (error: string) => NextResponse.json({ error }, { status: 400, headers: { "cache-control": "no-store" } });
