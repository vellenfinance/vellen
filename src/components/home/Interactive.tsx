"use client";

import Link from "next/link";
import { useState } from "react";
import { FAQ_BUILDERS, FAQ_HOLDERS } from "@/lib/faq";
import { crosses, gapPpm } from "@/lib/gap/math";
import { pct } from "@/lib/gap/view";
import { ArrowDown, ArrowRight } from "@/components/site/Icons";
import { SampleBadge } from "@/components/site/PageHead";

/* Tabs over a dark panel (the reference's "guided" block): one worked example per rule side. Sample numbers, labelled. */
const NAV = 100n * 10n ** 16n; // 1.00
const EXAMPLES = [
  { key: "premium", label: "Premium", dir: 1, price: 105n * 10n ** 16n, text: "Price above NAV. A premium rule at 2 % triggers when the token trades 2 % or more above what its holdings are worth." },
  { key: "discount", label: "Discount", dir: 2, price: 97n * 10n ** 16n, text: "Price below NAV. A discount rule at 2 % triggers at 2 % or more below." },
  { key: "either", label: "Either side", dir: 3, price: 1015n * 10n ** 15n, text: "Both edges count. Inside the band the rule stays quiet." },
] as const;

export function RuleTabs() {
  const [k, setK] = useState(0);
  const ex = EXAMPLES[k];
  const g = gapPpm(ex.price, NAV);
  const hit = crosses(ex.dir, 200, g);
  return (
    <div className="hero dark rounded-[24px] px-6 py-12 md:px-14 md:py-16" style={{ minHeight: 0 }} data-testid="rule-tabs">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="seg" role="group" aria-label="Rule side">
          {EXAMPLES.map((e, i) => (
            <button key={e.key} type="button" aria-pressed={i === k} onClick={() => setK(i)}>
              {e.label}
            </button>
          ))}
        </div>
        <SampleBadge label="Sample numbers" />
      </div>
      <div key={ex.key} className="swap-in mt-10 grid items-end gap-8 md:grid-cols-[1fr_auto]">
        <div>
          <p className="t14 muted">
            Price ${(Number(ex.price) / 1e18).toFixed(3)} vs NAV $1.000 · threshold 2 %
          </p>
          <p className="d2 mono mt-3">{pct(g.toString())}</p>
          <p className="t15 mt-3 max-w-[560px] text-[rgba(242,236,226,0.75)]">{ex.text}</p>
        </div>
        <p className={`rounded-full px-6 py-3 t15 font-medium ${hit ? "bg-[var(--cream)] text-black" : "border border-white/30"}`}>{hit ? "Rule triggers" : "Rule stays quiet"}</p>
      </div>
      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-6">
        <p className="t14 muted">Try it on the live reading, or record a rule on chain once the contract is deployed.</p>
        <Link href="/gap#calculator" className="pill pill-cream">
          Open the calculator <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

export function Faq() {
  const [who, setWho] = useState<"holders" | "builders">("holders");
  const list = who === "holders" ? FAQ_HOLDERS : FAQ_BUILDERS;
  return (
    <div className="grid gap-10 md:grid-cols-[1fr_1.4fr]" data-testid="faq">
      <div data-reveal="">
        <h2 className="d4">Questions, answered plainly</h2>
        <div className="seg mt-6" role="group" aria-label="Audience">
          <button type="button" aria-pressed={who === "holders"} onClick={() => setWho("holders")}>
            Holders
          </button>
          <button type="button" aria-pressed={who === "builders"} onClick={() => setWho("builders")}>
            Builders
          </button>
        </div>
      </div>
      <div key={who} className="grid gap-2" data-stagger>
        {list.map((f) => (
          <details key={f.q} className="acc">
            <summary>
              {f.q}
              <ArrowDown size={14} />
            </summary>
            <p className="body">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
