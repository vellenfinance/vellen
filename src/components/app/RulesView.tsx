"use client";

import { useCallback, useEffect, useState } from "react";
import { encodeFunctionData } from "viem";
import { CHAIN, explorerAddress } from "@/config/brand";
import { CONTRACTS, watchLive } from "@/config/contracts";
import { INDEX, TWAP_WINDOW } from "@/config/index";
import { WATCH_ABI } from "@/lib/abi";
import { explain, read, waitForReceipt } from "@/lib/client";
import { DIRECTIONS, type Direction } from "@/lib/gap/math";
import { ageOf, e18, money, pct, span } from "@/lib/gap/view";
import { useJson } from "@/lib/useJson";
import type { GapSnapshot } from "@/lib/server/gap";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { StatusBadge } from "@/components/site/PageHead";

/* The contract side: proposed track for the live index, tracks, latest checkpoint, rules with evaluate/fire. */

const STATUS = ["No checkpoint yet", "Rule switched off", "No market price", "NAV invalid", "NAV stale", "Price stale", "Holdings not covered", "Clear", "Cooldown", "Triggered"];
const MAX_NAV_AGE = 3 * 86400; // stock feeds pause over weekends
const MAX_PRICE_AGE = 86400;

type Track = { vault: string; asset: string; pool: string; creator: string; mode: number; ageSource: number; window: number; maxNavAge: number; maxPriceAge: number; createdAt: bigint; legsFixed: boolean };
type Checkpoint = { timestamp: bigint; navUpdatedAt: bigint; priceUpdatedAt: bigint; nav: bigint; price: bigint; gapPpm: bigint; flags: number; recorder: string };
type Rule = { owner: string; trackId: bigint; direction: number; thresholdBps: number; cooldown: number; active: boolean; lastFiredAt: bigint; lastFiredCheckpoint: bigint; fireCount: number };

const W = () => CONTRACTS.watch;
const r = <T,>(fn: string, args: readonly unknown[] = []) => read<T>({ to: W(), abi: WATCH_ABI, fn, args });
const data = (fn: string, args: readonly unknown[]) => encodeFunctionData({ abi: WATCH_ABI, functionName: fn, args } as never);

export function RulesView() {
  const live = watchLive();
  const { data: snap } = useJson<GapSnapshot>("/api/gap", 120_000);
  const legs = (snap?.legs ?? []).filter((l) => l.pool);
  return (
    <>
      <section className="wrap pt-12" data-reveal="" data-testid="rules-proposed">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="d4">The track for the live index</h2>
          <StatusBadge status={live ? "Prototype" : "Concept"} />
        </div>
        {!live ? (
          <p className="note mt-4" data-testid="not-deployed">
            VellenGapWatch is built and tested but not deployed yet. Nothing below is read from it; this is the exact setup the first track will use.
          </p>
        ) : null}
        <div className="card mt-6 grid gap-6 p-6 md:grid-cols-2 md:p-8">
          <dl className="grid content-start gap-2 t14">
            <Kv k="Index token" v={INDEX.vault} mono />
            <Kv k="Market side" v="Basket: holdings at their pools (no pool trades the index token)" />
            <Kv k="Age source" v="The index's oracle: oldest constituent price" />
            <Kv k="Time-weighted window" v={span(TWAP_WINDOW)} />
            <Kv k="Max NAV age" v={`${span(MAX_NAV_AGE)} (weekends)`} />
            <Kv k="Max pool-activity age" v={span(MAX_PRICE_AGE)} />
          </dl>
          <div>
            <p className="t14 muted">Pools per constituent (deepest {INDEX.assetSymbol} pool with a readable TWAP, from the live reading)</p>
            <ul className="mt-3 grid gap-2 t14">
              {legs.map((l) => (
                <li key={l.token} className="flex flex-wrap justify-between gap-2">
                  <span>{l.ticker ?? "Unproven token"}</span>
                  <a className="link addr" href={explorerAddress(l.pool!.address)} target="_blank" rel="noreferrer">
                    v3 {l.pool!.fee / 10_000}% · {l.pool!.address}
                  </a>
                </li>
              ))}
              {!snap ? <li className="muted">Reading…</li> : null}
            </ul>
          </div>
        </div>
      </section>
      {live ? <LiveRules legs={legs.map((l) => ({ token: l.token, pool: l.pool!.address }))} /> : <StatusTable />}
    </>
  );
}

const Kv = ({ k, v, mono }: { k: string; v: string; mono?: boolean }) => (
  <div className="grid gap-1 border-b border-black/10 pb-2 sm:grid-cols-[180px_1fr]">
    <dt className="muted">{k}</dt>
    <dd className={mono ? "addr" : ""}>{v}</dd>
  </div>
);

function StatusTable() {
  const rows: [string, string][] = [
    ["Triggered", "The latest checkpoint crosses the rule and the cooldown has passed. Anyone can call fire() to record it once."],
    ["Clear", "The gap is inside the threshold."],
    ["Cooldown", "Crossed, but the rule fired less than its cooldown ago (or on this same checkpoint)."],
    ["No market price", "The track has no market side (NAV only). Nothing to compare."],
    ["NAV stale / invalid", "The oldest constituent price is older than the track allows, or the oracle flagged a price."],
    ["Price stale", "A pool has had no activity for longer than the track allows."],
    ["Holdings not covered", "The constituent list does not explain the index's totalAssets (within 0.1 %)."],
  ];
  return (
    <section className="wrap pt-16" data-reveal="" data-testid="status-table">
      <h2 className="d4">What evaluate(rule) answers</h2>
      <div className="mt-6 grid gap-2" data-stagger>
        {rows.map(([k, v]) => (
          <div key={k} className="card-line grid gap-2 px-5 py-4 t14 md:grid-cols-[220px_1fr]">
            <b className="font-medium">{k}</b>
            <span className="muted">{v}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function LiveRules({ legs }: { legs: { token: string; pool: string }[] }) {
  const { address, onChain, sendTransaction, switchNetwork } = useWallet();
  const { open } = useWalletModal();
  const [tracks, setTracks] = useState<{ id: number; t: Track; cp: Checkpoint | null; count: number; preview: Checkpoint | null }[]>([]);
  const [mine, setMine] = useState<{ id: number; rule: Rule; status: number; gap: bigint }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ track: "0", dir: 3 as Direction, pct: "1", cooldown: "3600" });
  const now = Math.floor(Date.now() / 1000);

  const load = useCallback(async () => {
    try {
      const n = Number(await r<bigint>("trackCount"));
      const list = [];
      for (let i = 0; i < Math.min(n, 20); i++) {
        const t = await r<Track>("getTrack", [BigInt(i)]);
        const count = Number(await r<bigint>("checkpointCount", [BigInt(i)]));
        const cp = count ? (await r<Checkpoint[]>("getCheckpoints", [BigInt(i), BigInt(count - 1), 1n]))[0] : null;
        const preview = await r<Checkpoint>("preview", [BigInt(i)]).catch(() => null);
        list.push({ id: i, t, cp, count, preview });
      }
      setTracks(list);
      if (address) {
        const ids = await r<bigint[]>("rulesOf", [address]);
        const rows = [];
        for (const id of ids) {
          const rule = await r<Rule>("getRule", [id]);
          const ev = await r<readonly [number, bigint, bigint]>("evaluate", [id]);
          rows.push({ id: Number(id), rule, status: Number(ev[0]), gap: ev[1] });
        }
        setMine(rows);
      }
    } catch (e) {
      setMsg(explain(e));
    }
  }, [address]);
  useEffect(() => {
    load();
  }, [load]);

  async function send(label: string, fn: string, args: readonly unknown[]) {
    setBusy(true);
    setMsg(`${label}: confirm in the wallet…`);
    try {
      const hash = await sendTransaction({ to: W(), data: data(fn, args) });
      setMsg(`${label}: sent ${hash.slice(0, 12)}…`);
      const rc = await waitForReceipt(hash);
      setMsg(rc.ok ? `${label}: done (block ${rc.blockNumber}).` : `${label}: the transaction reverted.`);
      await load();
    } catch (e) {
      setMsg(`${label}: ${explain(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const needWallet = !address ? (
    <button type="button" className="pill pill-black" onClick={open}>
      Connect a wallet to write
    </button>
  ) : !onChain ? (
    <button type="button" className="pill pill-black" onClick={switchNetwork}>
      Switch to {CHAIN.name}
    </button>
  ) : null;

  return (
    <section className="wrap pt-16" data-reveal="" data-testid="rules-live">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="d4">Tracks and checkpoints</h2>
        <a className="link t14" href={explorerAddress(W())} target="_blank" rel="noreferrer">
          VellenGapWatch on the explorer
        </a>
      </div>
      {msg ? <p className="note info mt-4" aria-live="polite" data-testid="tx-msg">{msg}</p> : null}
      <div className="mt-6 grid gap-3" data-stagger>
        {tracks.map(({ id, t, cp, count, preview }) => (
          <div key={id} className="card p-6 t14" data-testid={`track-${id}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <b className="t18">Track #{id}</b>
              <span className="muted">{["NAV only", "Pool of the index token", "Basket at pools"][t.mode]} · {count} checkpoint(s)</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <p className="muted">Latest checkpoint</p>
                <p className="mono mt-1">{cp ? `${pct(cp.gapPpm.toString())} · NAV ${money(e18(cp.nav.toString()), 4)} · price ${money(e18(cp.price.toString()), 4)} · ${ageOf(Number(cp.timestamp), now)} ago` : "none yet"}</p>
              </div>
              <div>
                <p className="muted">If recorded now (preview)</p>
                <p className="mono mt-1">{preview ? `${pct(preview.gapPpm.toString())} · flags ${preview.flags}` : "not computable now"}</p>
              </div>
            </div>
            {needWallet ?? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="pill pill-black" disabled={busy} onClick={() => send("Record checkpoint", "recordCheckpoint", [BigInt(id)])} data-testid={`record-${id}`}>
                  Record a checkpoint
                </button>
              </div>
            )}
          </div>
        ))}
        {tracks.length === 0 ? <p className="muted t14">No track yet.</p> : null}
      </div>
      {!needWallet ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="pill pill-line"
            data-testid="open-track"
            disabled={busy || legs.length === 0}
            onClick={async () => {
              await send("Open track", "openTrack", [INDEX.vault, 2, "0x0000000000000000000000000000000000000000", 1, TWAP_WINDOW, MAX_NAV_AGE, MAX_PRICE_AGE]);
            }}
          >
            Open the basket track for the live index
          </button>
          <button
            type="button"
            className="pill pill-line"
            data-testid="set-legs"
            disabled={busy || legs.length === 0 || tracks.length === 0}
            onClick={() => send("Set pools", "setLegs", [BigInt(tracks.length - 1), legs.map((l) => l.token), legs.map((l) => l.pool)])}
          >
            Set its pools (newest track, creator only)
          </button>
        </div>
      ) : null}

      <h2 className="d4 mt-16">Your threshold rules</h2>
      <div className="card mt-6 grid gap-4 p-6 md:grid-cols-5 md:items-end">
        <label>
          <span className="lbl">Track</span>
          <input className="field mono" value={form.track} onChange={(e) => setForm({ ...form, track: e.target.value })} />
        </label>
        <label>
          <span className="lbl">Direction</span>
          <select className="field" value={form.dir} onChange={(e) => setForm({ ...form, dir: Number(e.target.value) as Direction })}>
            {DIRECTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="lbl">Threshold (%)</span>
          <input className="field mono" value={form.pct} onChange={(e) => setForm({ ...form, pct: e.target.value })} data-testid="rule-pct" />
        </label>
        <label>
          <span className="lbl">Cooldown (s)</span>
          <input className="field mono" value={form.cooldown} onChange={(e) => setForm({ ...form, cooldown: e.target.value })} data-testid="rule-cooldown" />
        </label>
        {needWallet ?? (
          <button
            type="button"
            className="pill pill-black"
            disabled={busy}
            data-testid="register-rule"
            onClick={() => send("Register rule", "registerRule", [BigInt(form.track || "0"), form.dir, Math.round(Number(form.pct) * 100), Number(form.cooldown)])}
          >
            Register rule
          </button>
        )}
      </div>
      <div className="mt-4 grid gap-2">
        {mine.map((m) => (
          <div key={m.id} className="card-line flex flex-wrap items-center justify-between gap-3 px-5 py-4 t14" data-testid={`rule-${m.id}`}>
            <span>
              Rule #{m.id} · track {m.rule.trackId.toString()} · {DIRECTIONS.find((d) => d.value === m.rule.direction)?.label} · {m.rule.thresholdBps / 100} % · fired {m.rule.fireCount}×
            </span>
            <span className="flex items-center gap-2">
              <span className={`tag ${m.status === 9 ? "live" : ""}`}>{STATUS[m.status]}</span>
              <span className="mono">{pct(m.gap.toString())}</span>
              {m.status === 9 ? (
                <button type="button" className="pill pill-black" disabled={busy} onClick={() => send("Fire", "fire", [BigInt(m.id)])} data-testid={`fire-${m.id}`}>
                  Record the crossing
                </button>
              ) : null}
              <button type="button" className="pill pill-line" disabled={busy} onClick={() => send(m.rule.active ? "Switch off" : "Switch on", "setRuleActive", [BigInt(m.id), !m.rule.active])}>
                {m.rule.active ? "Switch off" : "Switch on"}
              </button>
            </span>
          </div>
        ))}
        {address && mine.length === 0 ? <p className="muted t14">No rules for this wallet yet.</p> : null}
      </div>
      <p className="t12 muted mt-6">
        Writes are signed in your own wallet and pay gas in ETH. The contract holds no funds and has no owner. Deployed at block {CONTRACTS.block.toLocaleString("en-US")}.
      </p>
    </section>
  );
}
