"use client";

import { useEffect, useMemo, useState } from "react";
import { explorerAddress, explorerTx, shortAddress } from "@/config/brand";
import { INDEX, TWAP_WINDOW } from "@/config/index";
import { DIRECTIONS, band, crosses, gapPpm, type Direction } from "@/lib/gap/math";
import { ageOf, e18, gapWord, money, pct, span, units, utc } from "@/lib/gap/view";
import { useJson } from "@/lib/useJson";
import type { GapSnapshot, Leg } from "@/lib/server/gap";
import type { GapHistory } from "@/lib/server/gaphistory";
import { LiveBadge } from "@/components/site/PageHead";
import { GapChart } from "@/components/app/GapChart";
import { useWallet } from "@/components/wallet/WalletProvider";

type Snap = GapSnapshot & { servedAgeMs: number };
type Hist = GapHistory & { servedAgeMs: number };

function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 15_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

const Ext = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a className="link" href={href} target="_blank" rel="noreferrer">
    {children}
  </a>
);

/** The whole Gap Watch: market search, NAV, look-through basket, constituents, calculator, history. */
export function GapWatch() {
  const { data, error, loading } = useJson<Snap>("/api/gap", 30_000);
  const now = useNow();
  if (!data) {
    return (
      <section className="wrap py-16" data-testid="gap-loading">
        <div className="card p-8 text-center">{error ? <p className="down">{error} The reading is retried every 30 seconds.</p> : <p className="muted">{loading ? "Reading the index from Robinhood Chain…" : "No reading yet."}</p>}</div>
      </section>
    );
  }
  return (
    <>
      <Headline s={data} now={now} />
      <MarketSearch s={data} />
      <Constituents s={data} now={now} />
      <Calculator s={data} />
      <History s={data} />
    </>
  );
}

function Headline({ s, now }: { s: Snap; now: number }) {
  const nav = e18(s.index.nav);
  const parts = e18(s.index.navFromParts);
  const basket = e18(s.basket.twap);
  const navAge = s.index.navUpdatedAt ? now - s.index.navUpdatedAt : null;
  return (
    <section className="wrap pt-12 md:pt-16" data-testid="headline">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Index</p>
          <h2 className="d4 mt-2">The live IPO index on Robinhood Chain</h2>
          <p className="t14 muted mt-2">
            Index token <Ext href={explorerAddress(INDEX.vault)}>{shortAddress(INDEX.vault, 8, 6)}</Ext> · ERC-4626, priced in {INDEX.assetSymbol} · not affiliated
            with {"Vellen"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LiveBadge />
          <span className="tag">block {s.block.toLocaleString("en-US")}</span>
          <span className="tag">read {s.servedAgeMs > 0 ? span(s.servedAgeMs / 1000) : "now"} ago</span>
        </div>
      </div>

      <div className="mt-8 grid gap-3 md:grid-cols-3">
        <div className="card p-6" data-testid="card-market">
          <p className="t14 muted">Market price of the index token</p>
          {s.market.found ? (
            <p className="d3 mt-3">Pool found</p>
          ) : (
            <p className="d3 mt-3" data-testid="market-none">
              No market
            </p>
          )}
          <p className="t14 muted mt-3">
            {s.market.found
              ? "A pool for the index token exists; see the search below. Its price is not read yet by this prototype."
              : `No pool trades the index token on Uniswap v2, v3 or v4 on Robinhood Chain (searched at block ${s.block.toLocaleString("en-US")}). Mint and redeem with the index itself is the only way in and out, at NAV.`}
          </p>
        </div>
        <div className="card p-6" data-testid="card-nav">
          <p className="t14 muted">NAV per token</p>
          <p className="d3 mono mt-3" data-testid="nav-value">
            {money(nav, 4)}
          </p>
          <p className="t14 muted mt-3">
            convertToAssets(1 token) on the index, in {INDEX.assetSymbol}. Prices age: oldest constituent price{" "}
            <b className={navAge !== null && navAge > 86400 ? "down" : ""}>{ageOf(s.index.navUpdatedAt, now)}</b> old
            {navAge !== null && navAge > 86400 ? " (stock feeds pause outside US market hours)" : ""}.
          </p>
        </div>
        <div className="card p-6" data-testid="card-gap">
          <p className="t14 muted">Gap: market price vs NAV</p>
          <p className="d3 mt-3">{s.market.found ? "—" : "Not measurable"}</p>
          <p className="t14 muted mt-3">With no market price there is no premium or discount of the token itself. The look-through gap below is the closest real measure.</p>
        </div>
      </div>

      <div className="redcard dark mt-3 grid gap-6 p-6 md:grid-cols-[1.2fr_1fr] md:p-10" data-testid="card-basket">
        <div>
          <p className="t14 muted">Look-through: the index&apos;s holdings priced at their own pools</p>
          <p className="d2 mono mt-3" data-testid="basket-gap">
            {pct(s.basket.gapTwapPpm)}
          </p>
          <p className="t18 mt-2">
            {s.basket.gapTwapPpm !== null ? `${gapWord(s.basket.gapTwapPpm)} of the basket at pool prices over NAV` : "Not every constituent has a readable pool"}
          </p>
          <p className="t14 muted mt-4 max-w-[560px]">
            Each constituent the index holds is valued at the {span(TWAP_WINDOW)} time-weighted price of its deepest {INDEX.assetSymbol} pool, plus the index&apos;s cash,
            divided by the token supply. NAV values the same holdings at the oracle (Chainlink) prices. A positive gap means the holdings trade above their oracle
            value on chain. It is a measurement, not a signal.
          </p>
        </div>
        <dl className="grid content-start gap-3 t15">
          <Row k="Basket at pool TWAP, per token" v={money(e18(s.basket.twap), 4)} />
          <Row k="Basket at pool spot, per token" v={`${money(e18(s.basket.spot), 4)} (${pct(s.basket.gapSpotPpm)})`} />
          <Row k="NAV per token (index)" v={money(nav, 4)} />
          <Row k="NAV recomputed from holdings" v={`${money(parts, 4)} ${s.index.coverageOk ? "· matches totalAssets" : "· does NOT match totalAssets"}`} />
          <Row k="Oldest pool activity" v={ageOf(s.basket.oldestObservation, now)} />
          <Row k="Oldest constituent price" v={ageOf(s.index.navUpdatedAt, now)} />
          <Row k="Basket value" v={basket === null ? "—" : `${s.legs.length} constituents + cash`} />
        </dl>
      </div>
    </section>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-white/10 pb-2">
    <dt className="muted">{k}</dt>
    <dd className="mono text-right">{v}</dd>
  </div>
);

function MarketSearch({ s }: { s: Snap }) {
  return (
    <section className="wrap pt-16" data-testid="market-search">
      <h2 className="d4">Where a market was looked for</h2>
      <p className="t15 muted mt-3 max-w-[760px]">
        Every venue Vellen checks for a pool of the index token, with the answer the chain gave. If one appears later, this list says so and the gap becomes
        measurable.
      </p>
      <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {s.market.checks.map((c, i) => (
          <div key={i} className="card-line flex items-center justify-between gap-3 px-4 py-3 t14">
            <span>
              {c.venue} <span className="muted">· {c.pair}</span>
            </span>
            <span className={c.result === "found" ? "tag live" : c.result === "none" ? "tag" : "tag bad"}>{c.result === "found" ? "pool" : c.result === "none" ? "none" : "unreadable"}</span>
          </div>
        ))}
        <div className="card-line flex items-center justify-between gap-3 px-4 py-3 t14">
          <span>
            Uniswap v4 <span className="muted">· any pool with the index token</span>
          </span>
          <span className={s.market.v4.pools.length ? "tag live" : s.market.v4.gaps.length ? "tag bad" : "tag"}>
            {s.market.v4.pools.length ? `${s.market.v4.pools.length} pool(s)` : s.market.v4.gaps.length ? "partly read" : "none"}
          </span>
        </div>
      </div>
      <p className="t12 muted mt-3">
        v4: PoolManager Initialize logs from block {s.market.v4.from.toLocaleString("en-US")} (the index&apos;s deployment) to {s.market.v4.to.toLocaleString("en-US")}
        {s.market.v4.gaps.length ? `; ${s.market.v4.gaps.length} range(s) could not be read and are retried` : ""}.
      </p>
    </section>
  );
}

function Constituents({ s, now }: { s: Snap; now: number }) {
  const { address } = useWallet();
  const total = s.legs.reduce((a, l) => a + (e18(l.valueOracle) ?? 0), 0) + Number(s.index.cash) / 1e6;
  return (
    <section className="wrap pt-16" data-testid="constituents">
      <h2 className="d4">What the index holds</h2>
      <p className="t15 muted mt-3 max-w-[760px]">
        Constituents from the index&apos;s own list (getActiveTokens). A ticker is shown only for official stock tokens proven on chain (proxy code, beacon, supply);
        they are tokens on Robinhood Chain, not the shares themselves. {address ? "" : "Connecting a wallet is not needed for any of this."}
      </p>
      <div className="mt-6 grid gap-2 lg:hidden" data-testid="leg-cards">
        {s.legs.map((l) => (
          <LegCard key={l.token} l={l} total={total} now={now} />
        ))}
        <div className="card-line p-4 t14">
          Cash <span className="muted">({INDEX.assetSymbol})</span> <span className="mono float-right">{units(s.index.cash, INDEX.assetDecimals)}</span>
        </div>
      </div>
      <div className="mt-6 hidden lg:block">
        <table className="tbl">
          <thead>
            <tr>
              <th>Constituent</th>
              <th className="r">Held by the index</th>
              <th className="r">Value share</th>
              <th className="r">Oracle price · age</th>
              <th className="r">Pool {span(TWAP_WINDOW)} TWAP</th>
              <th className="r">Pool vs oracle</th>
              <th>Pool · last activity</th>
            </tr>
          </thead>
          <tbody>
            {s.legs.map((l) => (
              <LegRow key={l.token} l={l} total={total} now={now} />
            ))}
            <tr>
              <td>
                Cash <span className="muted">({INDEX.assetSymbol})</span>
              </td>
              <td className="r mono">{units(s.index.cash, INDEX.assetDecimals)}</td>
              <td className="r mono">{total > 0 ? `${((Number(s.index.cash) / 1e6 / total) * 100).toFixed(2)} %` : "—"}</td>
              <td className="r mono">$1 (by the index)</td>
              <td className="r">—</td>
              <td className="r">—</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LegCard({ l, total, now }: { l: Leg; total: number; now: number }) {
  const v = e18(l.valueOracle) ?? 0;
  const kv: [string, React.ReactNode][] = [
    ["Held by the index", units(l.balance, l.decimals)],
    ["Value share", total > 0 ? `${((v / total) * 100).toFixed(2)} %` : "—"],
    ["Oracle price", `${money(e18(l.oracle?.price), 2)} · ${ageOf(l.oracle?.updatedAt, now)} old`],
    [`Pool ${span(TWAP_WINDOW)} TWAP`, money(e18(l.pool?.twap), 2)],
    ["Pool vs oracle", pct(l.gapPpm)],
    ["Pool", l.pool ? `v3 ${l.pool.fee / 10_000}% · ${units(l.pool.depth, INDEX.assetDecimals, 0)} ${INDEX.assetSymbol} deep · ${ageOf(l.pool.lastObservation, now)}` : "no readable pool"],
  ];
  return (
    <div className="card-line p-4" data-testid="leg-card">
      <p className="t15">
        {l.proven ? <b>{l.ticker}</b> : <span className="muted">Unproven token</span>} <span className="muted">{l.company}</span>
      </p>
      <Ext href={explorerAddress(l.token)}>
        <span className="addr">{l.token}</span>
      </Ext>
      <dl className="mt-3 grid gap-1 t14">
        {kv.map(([k, val]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="muted">{k}</dt>
            <dd className="mono text-right">{val}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function LegRow({ l, total, now }: { l: Leg; total: number; now: number }) {
  const v = e18(l.valueOracle) ?? 0;
  return (
    <tr data-testid="leg-row">
      <td>
        {l.proven ? (
          <>
            <b>{l.ticker}</b> <span className="muted">{l.company}</span>
          </>
        ) : (
          <span className="muted">Unproven token</span>
        )}
        <div>
          <Ext href={explorerAddress(l.token)}>
            <span className="addr">{shortAddress(l.token, 6, 4)}</span>
          </Ext>
        </div>
      </td>
      <td className="r mono">{units(l.balance, l.decimals)}</td>
      <td className="r mono">{total > 0 ? `${((v / total) * 100).toFixed(2)} %` : "—"}</td>
      <td className="r mono">
        {money(e18(l.oracle?.price), 2)}
        <div className={`t12 ${l.oracle && now - l.oracle.updatedAt > 86400 ? "down" : "muted"}`}>
          {ageOf(l.oracle?.updatedAt, now)}
          {l.oracle?.feed ? (
            <>
              {" · "}
              <Ext href={explorerAddress(l.oracle.feed)}>feed</Ext>
            </>
          ) : null}
        </div>
      </td>
      <td className="r mono">{money(e18(l.pool?.twap), 2)}</td>
      <td className={`r mono ${l.gapPpm && Number(l.gapPpm) >= 0 ? "up" : "down"}`}>{pct(l.gapPpm)}</td>
      <td className="t14">
        {l.pool ? (
          <>
            <Ext href={explorerAddress(l.pool.address)}>v3 {l.pool.fee / 10_000}%</Ext>
            <span className="muted"> · {units(l.pool.depth, INDEX.assetDecimals, 0)} {INDEX.assetSymbol} deep</span>
            <div className="t12 muted">{ageOf(l.pool.lastObservation, now)}</div>
          </>
        ) : (
          <span className="muted">no readable pool</span>
        )}
      </td>
    </tr>
  );
}

function Calculator({ s }: { s: Snap }) {
  const nav = BigInt(s.index.nav);
  const basket = s.basket.twap;
  const [mode, setMode] = useState<"basket" | "manual">(basket ? "basket" : "manual");
  const [manual, setManual] = useState("1.05");
  const [thr, setThr] = useState("2");
  const [dir, setDir] = useState<Direction>(3);
  const priceE18 = useMemo(() => {
    if (mode === "basket" && basket) return BigInt(basket);
    const m = manual.trim();
    if (!/^\d{1,9}(\.\d{1,12})?$/.test(m)) return null;
    const [a, b = ""] = m.split(".");
    return BigInt(a) * 10n ** 18n + BigInt((b + "0".repeat(18)).slice(0, 18));
  }, [mode, basket, manual]);
  const bps = Math.round(Number(thr) * 100);
  const okThr = Number.isFinite(bps) && bps >= 1 && bps <= 50_000;
  const g = priceE18 !== null && nav > 0n ? gapPpm(priceE18, nav) : null;
  const hit = g !== null && okThr ? crosses(dir, bps, g) : null;
  const b = okThr ? band(nav, bps) : null;
  return (
    <section className="wrap pt-20" id="calculator" data-testid="calculator">
      <div className="card grid gap-8 p-6 md:grid-cols-[1fr_1fr] md:p-10">
        <div>
          <p className="eyebrow">Threshold calculator · Prototype</p>
          <h2 className="d4 mt-3">Tell me when the gap passes x %</h2>
          <p className="t15 muted mt-3">
            The same rule the contract&apos;s evaluate() uses: gap = (price − NAV) ÷ NAV; exactly at the threshold counts as crossed. Alerts themselves are planned;
            this shows what a rule would say right now.
          </p>
          <div className="mt-6 grid gap-4">
            <div className="seg" role="group" aria-label="Price source">
              <button type="button" aria-pressed={mode === "basket"} disabled={!basket} onClick={() => setMode("basket")}>
                Basket at pool prices
              </button>
              <button type="button" aria-pressed={mode === "manual"} onClick={() => setMode("manual")}>
                Enter a price
              </button>
            </div>
            {mode === "manual" ? (
              <label>
                <span className="lbl">Price per index token ({INDEX.assetSymbol})</span>
                <input className="field mono" inputMode="decimal" value={manual} onChange={(e) => setManual(e.target.value)} data-testid="calc-price" />
              </label>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="lbl">Threshold (%)</span>
                <input className="field mono" inputMode="decimal" value={thr} onChange={(e) => setThr(e.target.value)} data-testid="calc-threshold" />
              </label>
              <label>
                <span className="lbl">Direction</span>
                <select className="field" value={dir} onChange={(e) => setDir(Number(e.target.value) as Direction)} data-testid="calc-direction">
                  {DIRECTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
        <div className="grid content-start gap-3" aria-live="polite">
          <div className="rounded-2xl bg-white p-6">
            <p className="t14 muted">Price {mode === "basket" ? "(basket at pool TWAP)" : "(entered)"} vs live NAV {money(e18(s.index.nav), 4)}</p>
            <p className="d3 mono mt-2" data-testid="calc-gap">
              {g === null ? "—" : pct(g.toString(), 3)}
            </p>
            <p className="t15 mt-1">{g === null ? "Enter a price like 1.05" : gapWord(g.toString())}</p>
          </div>
          <div className={`rounded-2xl p-6 ${hit ? "bg-[#c8231f] text-[#fcf8f1]" : "bg-white"}`} data-testid="calc-result">
            <p className="t18">{hit === null ? "Set a threshold between 0.01 and 500 %" : hit ? "The rule would trigger" : "The rule would stay quiet"}</p>
            {b ? (
              <p className={`t14 mt-2 ${hit ? "" : "muted"}`}>
                Quiet band: {money(e18(b.low.toString()), 4)} to {money(e18(b.high.toString()), 4)} per token
                {dir === 1 ? " (only the upper edge counts)" : dir === 2 ? " (only the lower edge counts)" : ""}.
              </p>
            ) : null}
          </div>
          <p className="t12 muted">Example from the plan: a price of $1.05 against a NAV of $1.00 is a +5 % premium.</p>
        </div>
      </div>
    </section>
  );
}

function History({ s }: { s: Snap }) {
  const { data, error, loading } = useJson<Hist>("/api/gap/history", 0);
  return (
    <section className="wrap pt-20" id="history" data-testid="history">
      <h2 className="d4">What the chain can prove about the past</h2>
      <p className="t15 muted mt-3 max-w-[820px]">
        Every mint and redeem of the index token executed at a price (assets ÷ tokens, from the event). Next to it: NAV read at the block before, so the gap of each
        execution is exact. The line is NAV and the basket at pool prices, sampled at evenly spaced blocks since the index started (archive reads).
      </p>
      {!data ? (
        <div className="card mt-6 p-8 text-center t15">{error ? <span className="down">{error}</span> : <span className="muted">{loading ? "Reading the history (archive reads, up to a minute the first time)…" : "—"}</span>}</div>
      ) : (
        <>
          <div className="card mt-6 p-4 md:p-6">
            <GapChart samples={data.samples} executions={data.executions} />
            {!data.archive ? <p className="note mt-3">The archive endpoint did not answer every sample; missing points are left out, not filled in.</p> : null}
          </div>
          <div className="mt-6 grid gap-2 lg:hidden">
            {data.executions.map((x) => (
              <div key={x.tx + x.kind} className="card-line p-4 t14" data-testid="execution-card">
                <div className="flex justify-between gap-3">
                  <b className="font-medium">{x.kind}</b>
                  <span className="mono muted">{utc(x.time)}</span>
                </div>
                <div className="mono mt-2 flex justify-between gap-3">
                  <span>
                    {money(e18(x.price), 4)} <span className="muted">vs NAV</span> {money(e18(x.navBefore), 4)}
                  </span>
                  <span>{pct(x.gapPpm)}</span>
                </div>
                <div className="mt-1 flex justify-between gap-3 muted">
                  <span className="mono">
                    {units(x.assets, INDEX.assetDecimals)} {INDEX.assetSymbol} · {units(x.shares, INDEX.decimals, 6)} tokens
                  </span>
                  <Ext href={explorerTx(x.tx)}>tx</Ext>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 hidden lg:block">
            <table className="tbl" data-testid="executions">
              <thead>
                <tr>
                  <th>When (UTC)</th>
                  <th>Kind</th>
                  <th className="r">{INDEX.assetSymbol}</th>
                  <th className="r">Index tokens</th>
                  <th className="r">Executed price</th>
                  <th className="r">NAV, block before</th>
                  <th className="r">Gap</th>
                  <th>Proof</th>
                </tr>
              </thead>
              <tbody>
                {data.executions.map((x) => (
                  <tr key={x.tx + x.kind}>
                    <td className="mono t14">{utc(x.time)}</td>
                    <td>{x.kind}</td>
                    <td className="r mono">{units(x.assets, INDEX.assetDecimals)}</td>
                    <td className="r mono">{units(x.shares, INDEX.decimals, 6)}</td>
                    <td className="r mono">{money(e18(x.price), 4)}</td>
                    <td className="r mono">{money(e18(x.navBefore), 4)}</td>
                    <td className="r mono">{pct(x.gapPpm)}</td>
                    <td>
                      <Ext href={explorerTx(x.tx)}>tx</Ext>
                    </td>
                  </tr>
                ))}
                {data.executions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="muted">
                      No mint or redeem since the index was deployed.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="t12 muted mt-3">
            Blocks {data.from.toLocaleString("en-US")} to {data.to.toLocaleString("en-US")}
            {data.gaps.length ? `; ${data.gaps.length} range(s) unread, retried on the next load` : ", read completely"}. History read{" "}
            {data.servedAgeMs > 0 ? `${span(data.servedAgeMs / 1000)} ago` : "now"}; the live reading above is from block {s.block.toLocaleString("en-US")}.
          </p>
        </>
      )}
    </section>
  );
}
