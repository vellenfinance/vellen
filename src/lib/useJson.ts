"use client";

import { useEffect, useState } from "react";

/**
 * GETs a JSON route, refreshes it every `every` ms while the tab is visible (polling pauses when hidden), and keeps the last
 * good answer when a refresh fails. `url` null = do nothing.
 */
export function useJson<T>(url: string | null, every = 60_000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  useEffect(() => {
    if (!url) return;
    let dead = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      if (document.visibilityState === "hidden") {
        timer = setTimeout(load, 5_000);
        return;
      }
      try {
        if (!dead) setLoading(true);
        const res = await fetch(url, { cache: "no-store" });
        const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
        if (dead) return;
        if (!res.ok || !body) setError(body?.error ?? `Request failed (${res.status}).`);
        else {
          setData(body);
          setError(null);
        }
      } catch {
        if (!dead) setError("Network error.");
      } finally {
        if (!dead) setLoading(false);
      }
      if (!dead && every > 0) timer = setTimeout(load, every);
    };
    load();
    return () => {
      dead = true;
      if (timer) clearTimeout(timer);
    };
  }, [url, every]);
  return { data, error, loading };
}
