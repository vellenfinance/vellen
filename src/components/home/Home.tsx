import Link from "next/link";
import { BRAND } from "@/config/brand";
import { FEATURES } from "@/config/status";
import { ArrowDown, ArrowRight } from "@/components/site/Icons";
import { Reveal } from "@/components/site/Reveal";
import { StatusBadge } from "@/components/site/PageHead";
import { ConstituentCards, HeroReadout, LivePanel, StatsLine } from "@/components/home/Live";
import { Faq, RuleTabs } from "@/components/home/Interactive";

/* Home in the UI reference's order: hero, statement band, intro with glass cards, inset media, the product card, two-tone
   headline with art cards, operators grid, guided panel with tabs, live bento, why-cards, pricing card, CTA band, steps,
   claims we do not make (in the testimonial slot), FAQ. Every number on it is live or labelled. */

const go = <ArrowRight size={14} />;

function Hero() {
  return (
    <section className="hero dark flex flex-col" data-testid="hero">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute top-[54%] left-1/2 h-[min(70vw,720px)] w-[min(70vw,720px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
        <div className="absolute top-[54%] left-1/2 h-[min(46vw,470px)] w-[min(46vw,470px)] -translate-x-1/2 -translate-y-1/2 rounded-full border-[10px] border-[rgba(255,122,82,0.35)] blur-[1px]" />
        <div className="absolute top-[64%] left-[66%] h-[min(18vw,180px)] w-[min(18vw,180px)] rounded-full opacity-80 bg-[radial-gradient(circle,#ff9b6e,#e2412c_55%,rgba(226,65,44,0)_72%)] blur-[2px]" />
      </div>
      <div className="wrap relative flex flex-1 flex-col items-center justify-center pt-[120px] pb-16 text-center">
        <p className="eyebrow">Concept · working prototype · planned for {BRAND.chainName}</p>
        <h1 className="d1 mt-6 max-w-[1200px]">IPO index price vs.&nbsp;NAV.</h1>
        <p className="t18 mt-6 max-w-[620px] font-normal text-[rgba(242,236,226,0.8)]">{BRAND.tagline}</p>
        <Link href="/gap" className="pill pill-cream lg mt-10" data-testid="hero-cta">
          Open the Gap Watch {go}
        </Link>
        <p className="t15 mt-4 text-[rgba(242,236,226,0.6)]">free · no wallet · no token · live from the chain</p>
        <div className="mt-14 max-w-[900px]">
          <HeroReadout />
        </div>
      </div>
      <div className="relative border-t border-white/10">
        <div className="wrap flex flex-wrap items-center justify-center gap-x-10 gap-y-2 py-5 t14 text-[rgba(242,236,226,0.45)]">
          <span>Read from:</span>
          <span>ERC-4626 index token</span>
          <span>its constituent list</span>
          <span>Chainlink price feeds</span>
          <span>Uniswap v3 pools</span>
          <span>Uniswap v4 PoolManager logs</span>
        </div>
      </div>
    </section>
  );
}

function Statement() {
  return (
    <section className="band dark flex min-h-[78vh] items-center" data-testid="statement">
      <div className="wrap text-center">
        <Reveal>
          <h2 className="d4 mx-auto max-w-[860px]">A premium is a number with an age. Vellen shows you both, and where each one came from.</h2>
        </Reveal>
      </div>
    </section>
  );
}

function Intro() {
  const cards = [
    ["Market price of the index token,", " from a pool if one exists, and a plain “no market” when none does"],
    ["NAV per token,", " from the index itself, with the age of the oldest price behind it"],
    ["The gap in percent,", " plus the holdings priced at their own pools when the token has no market"],
  ];
  return (
    <section className="band dark py-24 md:py-32" data-testid="intro">
      <div className="wrap text-center">
        <Reveal>
          <p className="t18 mx-auto max-w-[600px]">
            One question, answered with live chain data: <span className="text-[rgba(242,236,226,0.6)]">how far is an IPO index token&apos;s price above or below the value of what it holds?</span>
          </p>
        </Reveal>
        <div className="mx-auto mt-10 grid max-w-[960px] gap-3 text-left md:grid-cols-3">
          {cards.map(([b, r], i) => (
            <Reveal key={i} delay={i * 80} className="glass min-h-[116px] p-5 t15">
              <span className="text-[rgba(242,236,226,0.7)]">
                <b className="font-medium text-[var(--cream)]">{b}</b>
                {r}
              </span>
            </Reveal>
          ))}
        </div>
        <Link href="/gap" className="pill pill-black lg mt-10">
          Open the Gap Watch {go}
        </Link>
        <p className="t18 mx-auto mt-20 max-w-[620px]">
          Every number carries its timestamp and a link to the contract, feed or transaction it was read from, so you can check it yourself instead of trusting a
          screenshot.
        </p>
        <p className="mt-10 inline-flex items-center gap-3 text-[22px] font-medium">
          Planned for {BRAND.chainName} <span className="tag proto">Prototype runs today</span>
        </p>
      </div>
    </section>
  );
}

function Product() {
  const specs = [
    ["NAV", "convertToAssets of one token, read live from the index"],
    ["Prices", "each constituent's Chainlink price and its age"],
    ["Pools", "30-minute time-weighted price of the deepest pool"],
    ["History", "every mint and redeem against NAV at the block before"],
  ];
  return (
    <section className="wrap pt-4" data-testid="product">
      <div className="hero dark rounded-[24px] px-6 py-16 text-center md:px-16 md:py-24" style={{ minHeight: 0 }}>
        <Reveal>
          <h2 className="d3">The Gap Watch</h2>
          <p className="t18 mx-auto mt-4 max-w-[520px] font-normal">
            One screen for one index token. <span className="text-[rgba(242,236,226,0.5)]">Built to show its sources.</span>
          </p>
        </Reveal>
        <div aria-hidden="true" className="mx-auto my-14 grid max-w-[620px] grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="rounded-full border border-white/25 py-5 text-center">
            <p className="t12 muted">price</p>
            <p className="d4 mono">?</p>
          </div>
          <div className="h-[2px] w-16 bg-gradient-to-r from-[#ff7a52] to-[#ff5d8f]" />
          <div className="rounded-full bg-white/10 py-5 text-center">
            <p className="t12 muted">NAV</p>
            <p className="d4 mono">$</p>
          </div>
        </div>
        <div className="grid gap-6 text-left sm:grid-cols-2 lg:grid-cols-4">
          {specs.map(([k, v]) => (
            <div key={k} className="t14">
              <p className="font-medium">{k}</p>
              <p className="text-[rgba(242,236,226,0.65)]">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MoreThan() {
  const cards = [
    { k: "orb", t: "Market price.", d: "From a pool of the index token when one exists. When none exists, the page says so and shows where it looked." },
    { k: "orb ring", t: "NAV per token.", d: "What the index itself says one token is worth, plus the same figure recomputed from its holdings as a cross-check." },
    { k: "orb soft", t: "The gap.", d: "Premium or discount in percent. The PK example: $1.05 against a NAV of $1.00 is +5 %." },
    { k: "orb", t: "The age.", d: "Each number keeps its own time. Stock price feeds pause outside US market hours, so a weekend NAV is Friday's." },
  ];
  return (
    <section className="pt-28 md:pt-36" data-testid="more-than">
      <div className="wrap text-center">
        <Reveal>
          <h2 className="d4 two-tone mx-auto max-w-[760px]">
            More than a number. <span className="dim">A price, a NAV, a gap and an age, each with its source.</span>
          </h2>
        </Reveal>
      </div>
      <div className="mt-12 overflow-x-auto pb-4" data-qa-bleed>
        <div className="wrap flex gap-4">
          {cards.map((c, i) => (
            <Reveal key={i} delay={i * 70} className="w-[300px] shrink-0 md:w-[400px]">
              <div className={`${c.k} h-[220px] md:h-[300px]`} />
              <p className="t15 mt-4">
                <b className="font-medium">{c.t}</b> <span className="muted">{c.d}</span>
              </p>
            </Reveal>
          ))}
        </div>
      </div>
      <div className="mt-10 text-center">
        <Link href="/method" className="pill pill-black">
          How every number is computed {go}
        </Link>
      </div>
    </section>
  );
}

function Holders() {
  const items = [
    ["See the gap before you act.", "Mint and redeem with the index happen at NAV; a pool, when one exists, may not. The gap tells you which one is cheaper today."],
    ["Know how old the data is.", "A NAV built on Friday's closing prices is not a Monday quote. Every figure shows its age."],
    ["Check it yourself.", "Each number links to the contract, feed, pool or transaction it was read from."],
    ["Free, without a wallet.", `The whole Gap Watch works without connecting anything and without ${BRAND.symbol}.`],
  ];
  return (
    <section className="wrap pt-28 md:pt-40" data-testid="holders">
      <Reveal>
        <h2 className="d2 text-center">Built for holders</h2>
        <p className="t15 muted mt-3 text-center">Clarity, sources, ages, no advice.</p>
      </Reveal>
      <div className="mx-auto mt-14 grid max-w-[700px] gap-x-12 gap-y-10 md:grid-cols-2">
        {items.map(([b, t]) => (
          <p key={b} className="t15">
            <b className="font-medium">{b}</b> <span className="muted">{t}</span>
          </p>
        ))}
      </div>
    </section>
  );
}

function Guided() {
  return (
    <section className="wrap pt-28 md:pt-36" data-testid="guided">
      <Reveal>
        <h2 className="d4 mx-auto max-w-[620px] text-center">Pick a side. Set a threshold. See what a rule would say.</h2>
      </Reveal>
      <div className="mt-10">
        <RuleTabs />
      </div>
    </section>
  );
}

function LiveBento() {
  return (
    <section className="wrap pt-28 md:pt-36" data-testid="live-bento">
      <Reveal>
        <StatsLine />
        <p className="t14 muted mt-4 text-center">Constituents, weights, prices and pools of the live IPO index on {BRAND.chainName}, refreshed every minute.</p>
      </Reveal>
      <div className="mt-10">
        <ConstituentCards />
      </div>
    </section>
  );
}

function Why() {
  const cards = [
    ["No invented market.", "If nothing trades the index token, Vellen says “no market” instead of borrowing a price from somewhere else."],
    ["Manipulation-aware.", "Pool prices are 30-minute time-weighted averages, the same window the contract uses, so one block cannot set them."],
    ["Proven tickers only.", "A company name appears only for official stock tokens proven on chain. Lookalike tokens stay unnamed."],
    ["The same math on chain.", "The site and VellenGapWatch share one formula, checked on 458 generated cases."],
  ];
  return (
    <section className="wrap pt-28 md:pt-36" data-testid="why">
      <p className="t15 muted text-center">Why Vellen reads differently</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([t, d], i) => (
          <Reveal key={t} delay={i * 60}>
            <div className={`${i % 2 ? "orb ring" : "orb"} h-[200px]`} />
            <p className="t15 mt-4">
              <b className="font-medium">{t}</b> <span className="muted">{d}</span>
            </p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section className="wrap pt-28 md:pt-36" data-testid="pricing">
      <div className="card px-6 py-12 md:px-12 md:py-16">
        <p className="t14 muted text-center">{BRAND.name}</p>
        <h2 className="d3 mt-2 text-center">Free to read. Rules on chain.</h2>
        <div className="mt-10 grid gap-3 md:grid-cols-4">
          {["No wallet needed", "No account, no e-mail", "Sources linked on every number", "Contract holds no funds"].map((t) => (
            <div key={t} className="rounded-2xl bg-white/70 p-5 t14">
              {t}
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="rounded-2xl bg-white/70 p-6">
            <p className="t14 muted">What runs today</p>
            <ul className="mt-3 grid gap-2 t15">
              {FEATURES.filter((f) => f.status === "Prototype").map((f) => (
                <li key={f.key} className="flex items-start justify-between gap-3">
                  <span>{f.name}</span> <StatusBadge status="Prototype" />
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-white/70 p-6">
            <p className="t14 muted">Comparison and calculator</p>
            <p className="d3 mt-6">Free</p>
            <p className="t14 muted mt-1">for everyone, always</p>
          </div>
          <div className="rounded-2xl bg-white/70 p-6">
            <p className="t14 muted">Threshold alerts</p>
            <p className="d4 mt-6">Planned</p>
            <p className="t14 muted mt-1">{BRAND.symbol} may be tested as credits for alerts. Not built; no price set.</p>
          </div>
        </div>
      </div>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4 t14 muted">
        <span>Want the formulas and the contract addresses?</span>
        <Link href="/method" className="pill pill-line text-[var(--ink)]">
          Read the method {go}
        </Link>
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="pt-24" data-testid="cta-band">
      <div className="band dark inset flex min-h-[460px] flex-col items-center justify-center px-6 text-center">
        <h2 className="d3 max-w-[760px]">Bring the gap into view before you mint, redeem or trade.</h2>
        <Link href="/gap" className="pill pill-black lg mt-10 border border-white/15">
          Open the Gap Watch {go}
        </Link>
      </div>
    </section>
  );
}

function Steps() {
  const steps = [
    ["Read the index", "Vellen reads the index token, its constituent list and each constituent's oracle price at the latest block."],
    ["Look for a market", "It asks every Uniswap v2 and v3 factory pair and scans v4 pool creations for the index token."],
    ["Price the holdings", "Each holding is valued at the 30-minute TWAP of its deepest pool, plus the index's cash, per token."],
    ["Compare and date", "The gap is (price − NAV) ÷ NAV, shown with the age of the oldest price on each side."],
    ["Record a rule (optional)", "With a wallet, register a threshold rule in VellenGapWatch; anyone can record a checkpoint the contract computes itself."],
  ];
  return (
    <section className="wrap pt-24" data-testid="steps">
      <div className="redcard dark px-6 py-14 md:px-16 md:py-20">
        <p className="t14 muted text-center">How a reading is made</p>
        <h2 className="d4 mt-3 text-center">From chain data to a dated gap in clear steps</h2>
        <div className="mx-auto mt-10 grid max-w-[560px] gap-2">
          {steps.map(([t, d], i) => (
            <details key={t} className="acc" open={i === 0}>
              <summary>
                {t}
                <ArrowDown size={14} />
              </summary>
              <p className="body">{d}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function NotClaimed() {
  const items = [
    ["“A premium is not a signal.”", "Vellen measures the gap. It never says buy, sell, mint or redeem, and it is not financial advice."],
    ["“No market means no price.”", "Today nothing trades the index token on Robinhood Chain. The look-through gap measures the holdings, not the token."],
    ["“Not affiliated.”", "Vellen is independent of Robinhood, of the index it reads and of every issuer. Stock tokens are tokens on Robinhood Chain, not shares."],
  ];
  return (
    <section className="wrap pt-24" data-testid="not-claimed">
      <p className="t14 muted">In our own words</p>
      <h2 className="d4 mt-2">What Vellen does not claim</h2>
      <div className="mt-8 grid gap-3 md:grid-cols-3">
        {items.map(([q, d]) => (
          <div key={q} className="card-line flex min-h-[220px] flex-col justify-between p-6">
            <p className="t18">{q}</p>
            <p className="t14 muted mt-6">{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Home() {
  return (
    <>
      <Hero />
      <Statement />
      <Intro />
      <div className="pt-4">
        <LivePanel />
      </div>
      <div className="pt-24">
        <Product />
      </div>
      <MoreThan />
      <Holders />
      <Guided />
      <LiveBento />
      <Why />
      <Pricing />
      <CtaBand />
      <Steps />
      <NotClaimed />
      <section className="wrap pt-24" id="faq">
        <Faq />
      </section>
    </>
  );
}
