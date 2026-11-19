"use client";

import { useState } from "react";
import type { Execution, Sample } from "@/lib/server/gaphistory";
import { e18, money, pct, utc } from "@/lib/gap/view";

/* NAV and basket-at-pool-prices per token over time (block samples), with every mint/redeem as a dot at its executed price. */
export function GapChart({ samples, executions }: { samples: Sample[]; executions: Execution[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const pts = samples.filter((p) => p.time && p.nav);
  const ex = executions.filter((x) => x.time);
  if (pts.length < 2) return <p className="muted t14">Not enough samples to draw yet.</p>;
  const W = 960;
  const H = 300;
  const P = { l: 64, r: 16, t: 16, b: 34 };
  const times = [...pts.map((p) => p.time as number), ...ex.map((x) => x.time as number)];
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const vals = [...pts.flatMap((p) => [e18(p.nav), e18(p.basket)]), ...ex.map((x) => e18(x.price))].filter((v): v is number => v !== null);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const pad = (hi - lo) * 0.12 || 0.01;
  lo -= pad;
  hi += pad;
  const x = (t: number) => P.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const line = (k: "nav" | "basket") =>
    pts
      .filter((p) => p[k])
      .map((p, i) => `${i ? "L" : "M"}${x(p.time as number).toFixed(1)},${y(e18(p[k]) as number).toFixed(1)}`)
      .join(" ");
  const ticks = Array.from({ length: 4 }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / 4);
  const hp = hover !== null ? pts[hover] : null;
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 t12">
        <span className="inline-flex items-center gap-2">
          <i className="inline-block h-[2px] w-5 bg-black" /> NAV per token
        </span>
        <span className="inline-flex items-center gap-2">
          <i className="inline-block h-[2px] w-5 bg-[#e2412c]" /> Basket at pool TWAP
        </span>
        <span className="inline-flex items-center gap-2">
          <i className="inline-block h-2 w-2 rounded-full bg-[#ff7a52] ring-2 ring-black" /> Mint / redeem at its executed price
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="NAV and basket price per index token over time"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const t = t0 + (((e.clientX - r.left) / r.width) * W - P.l) / (W - P.l - P.r) * (t1 - t0);
          let best = 0;
          pts.forEach((p, i) => {
            if (Math.abs((p.time as number) - t) < Math.abs((pts[best].time as number) - t)) best = i;
          });
          setHover(best);
        }}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="rgba(0,0,0,.08)" />
            <text x={P.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="rgba(0,0,0,.55)">
              {v.toFixed(4)}
            </text>
          </g>
        ))}
        <text x={P.l} y={H - 10} fontSize="11" fill="rgba(0,0,0,.55)">
          {utc(t0)}
        </text>
        <text x={W - P.r} y={H - 10} fontSize="11" fill="rgba(0,0,0,.55)" textAnchor="end">
          {utc(t1)}
        </text>
        <path d={line("nav")} fill="none" stroke="#000" strokeWidth="2" />
        <path d={line("basket")} fill="none" stroke="#e2412c" strokeWidth="2" />
        {ex.map((e) => (
          <circle key={e.tx + e.kind} cx={x(e.time as number)} cy={y(e18(e.price) as number)} r="5" fill="#ff7a52" stroke="#000" strokeWidth="1.5">
            <title>{`${e.kind} ${utc(e.time)}: ${money(e18(e.price), 4)} vs NAV ${money(e18(e.navBefore), 4)} (${pct(e.gapPpm)})`}</title>
          </circle>
        ))}
        {hp ? <line x1={x(hp.time as number)} x2={x(hp.time as number)} y1={P.t} y2={H - P.b} stroke="rgba(0,0,0,.3)" strokeDasharray="3 3" /> : null}
      </svg>
      <p className="t12 muted mt-2 min-h-[18px]" data-testid="chart-readout">
        {hp ? `${utc(hp.time)} · block ${hp.block.toLocaleString("en-US")} · NAV ${money(e18(hp.nav), 4)} · basket ${money(e18(hp.basket), 4)} · gap ${pct(hp.gapPpm)}${hp.listChanged ? " · constituent list differed then: basket not drawn" : ""}` : "Move over the chart to read a sample."}
      </p>
    </div>
  );
}
