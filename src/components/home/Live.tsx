"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { INDEX } from "@/config/index";
import { explorerAddress } from "@/config/brand";
import { ageOf, e18, gapWord, money, pct } from "@/lib/gap/view";
import { useJson } from "@/lib/useJson";
import type { GapSnapshot } from "@/lib/server/gap";
import { ArrowRight } from "@/components/site/Icons";

type Snap = GapSnapshot & { servedAgeMs: number };

export function useGap() {
  return useJson<Snap>("/api/gap", 60_000);
}

function useNow() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Math.floor(Date.now() / 1000));
    const t = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 15_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

/** Hero readout under the CTA: NAV, look-through gap, ages. */
export function HeroReadout() {
  const { data, error } = useGap();
  const now = useNow();
  if (!data)
    return (
      <p className="t15 text-[rgba(242,236,226,0.6)]" data-testid="hero-readout">
        {error ? "Live reading unavailable right now; retrying." : "Reading the live IPO index on Robinhood Chain…"}
      </p>
    );
  return (
    <p className="t15 text-[rgba(242,236,226,0.7)]" data-testid="hero-readout">
      Live now · NAV {money(e18(data.index.nav), 4)} per token · holdings at pool prices {pct(data.basket.gapTwapPpm)} · oldest price {ageOf(data.index.navUpdatedAt, now)}
    </p>
  );
}

/** The inset panel: big live numbers in the reference's media slot. */
export function LivePanel() {
  const { data, error } = useGap();
  const now = useNow();
  return (
    <div className="band dark inset px-6 py-14 md:px-16 md:py-20" data-testid="live-panel" data-scrub="inset">
      <div className="mx-auto grid max-w-[1180px] gap-10 md:grid-cols-3" data-stagger>
        <Figure label="Market price of the index token" value={data ? (data.market.found ? "Pool found" : "No market") : "…"} note={data ? (data.market.found ? "see the Gap Watch" : "no pool on Uniswap v2, v3 or v4") : ""} />
        <Figure label="NAV per token" value={data ? money(e18(data.index.nav), 4) : "…"} note={data ? `oldest price ${ageOf(data.index.navUpdatedAt, now)} old` : ""} mono />
        <Figure
          label="Holdings at their pool prices"
          value={data ? pct(data.basket.gapTwapPpm) : "…"}
          note={data ? `${gapWord(data.basket.gapTwapPpm)} vs NAV · 30-minute TWAP` : ""}
          mono
        />
      </div>
      <div className="mx-auto mt-12 flex max-w-[1180px] flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-6 t14 muted">
        <span>
          {error && !data ? "Live reading unavailable right now; retrying." : data ? `Block ${data.block.toLocaleString("en-US")} · ` : ""}
          Index token{" "}
          <a className="link" href={explorerAddress(INDEX.vault)} target="_blank" rel="noreferrer">
            {INDEX.vault.slice(0, 10)}…
          </a>{" "}
          · not affiliated with Vellen
        </span>
        <Link href="/gap" className="pill pill-cream">
          Open the Gap Watch <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

function Figure({ label, value, note, mono }: { label: string; value: string; note: string; mono?: boolean }) {
  return (
    <div>
      <p className="t14 muted">{label}</p>
      <p className={`d2 mt-3 ${mono ? "mono" : ""}`}>{value}</p>
      <p className="t14 muted mt-2">{note}</p>
    </div>
  );
}

/** "Live in real operations": one card per constituent, like the reference's location cards. */
export function ConstituentCards() {
  const { data } = useGap();
  const now = useNow();
  if (!data) return <div className="card h-[220px] animate-pulse" />;
  const total = data.legs.reduce((a, l) => a + (e18(l.valueOracle) ?? 0), 0);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="constituent-cards" data-stagger>
      {data.legs.map((l) => (
        <div key={l.token} className="orb soft min-h-[220px] p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="t18">{l.proven ? l.ticker : "Unproven token"}</p>
            <span className="tag live">
              <span className="dot" /> live
            </span>
          </div>
          <p className="t14 muted mt-1 line-clamp-2 break-words">{l.company ?? l.token}</p>
          <p className="d4 mono mt-8">{total > 0 ? `${(((e18(l.valueOracle) ?? 0) / total) * 100).toFixed(1)} %` : "—"}</p>
          <p className="t12 muted">of the holdings by oracle value</p>
          <p className="t14 mt-4">
            Pool vs oracle <b className="mono">{pct(l.gapPpm)}</b> · price {ageOf(l.oracle?.updatedAt, now)} old
          </p>
        </div>
      ))}
      <div className="card flex min-h-[220px] flex-col justify-between p-6">
        <p className="t18">Cash</p>
        <p className="d4 mono">{(Number(data.index.cash) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 6 })}</p>
        <p className="t14 muted">{INDEX.assetSymbol} held by the index, counted at $1 by its own accounting.</p>
      </div>
    </div>
  );
}

export function StatsLine() {
  const { data } = useGap();
  return (
    <p className="d4 two-tone text-center">
      Read from the chain, not copied from a page.{" "}
      <span className="dim">
        {data ? `${data.legs.length} constituents, ${data.legs.reduce((a, l) => a + l.pools.length, 0)} constituent pools and ${data.market.checks.length + 1} market venues checked` : "Constituents, pools and market venues checked"}{" "}
        at every reading.
      </span>
    </p>
  );
}
