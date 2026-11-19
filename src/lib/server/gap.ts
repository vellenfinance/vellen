import "server-only";
import { decodeFunctionResult, encodeFunctionData, keccak256, type Abi } from "viem";
import { INDEX, STOCK_TOKEN, TWAP_WINDOW, V4_INITIALIZE_TOPIC, VENUES } from "@/config/index";
import { ERC20_ABI, LIST_ABI, NAV_ORACLE_ABI, V2_FACTORY_ABI, V3_FACTORY_ABI, V3_POOL_ABI, VAULT_ABI } from "@/lib/abi";
import { gapPpm, priceFromSqrt, to1e18, twapPrice } from "@/lib/gap/math";
import { scanBack } from "@/lib/logscan";
import { logReader, multicall, rpc, rpcBatch } from "@/lib/server/chainread";

/*
 * One live reading of the index: NAV per token, every constituent's oracle price and age, the constituent pools (spot and
 * 30-minute time-weighted price, last activity), the look-through "basket at pool prices", and the search for a market of the
 * index token itself. All numbers are bigint strings scaled to 1e18 unless named otherwise; ages are unix seconds.
 */

const ZERO = "0x0000000000000000000000000000000000000000";
const E18 = 10n ** 18n;

type Call = { to: string; abi: Abi; fn: string; args?: readonly unknown[] };
const enc = (c: Call) => ({ to: c.to, data: encodeFunctionData({ abi: c.abi, functionName: c.fn, args: c.args ?? [] } as never) });
function dec<T>(c: Call, raw: string | null): T | null {
  if (!raw) return null;
  try {
    return decodeFunctionResult({ abi: c.abi, functionName: c.fn, data: raw as `0x${string}` } as never) as T;
  } catch {
    return null;
  }
}
async function mc(calls: Call[]): Promise<unknown[]> {
  const raw = await multicall(calls.map(enc));
  return calls.map((c, i) => dec(c, raw[i]));
}

export type PoolRead = {
  address: string;
  fee: number;
  baseIsToken0: boolean;
  depth: string; // USDG held by the pool, raw 6 dec
  spot: string | null;
  twap: string | null;
  twapTick: number | null;
  lastObservation: number | null;
};

export type Leg = {
  token: string;
  proven: boolean;
  ticker: string | null;
  company: string | null;
  decimals: number;
  balance: string;
  oracle: { price: string; updatedAt: number; ok: boolean; feed: string | null; heartbeat: number | null } | null;
  pools: PoolRead[];
  pool: PoolRead | null;
  valueOracle: string; // USD 1e18 held by the index
  valuePool: string | null;
  gapPpm: string | null; // pool TWAP vs oracle
};

export type MarketCheck = { venue: string; pair: string; result: "none" | "found" | "unreadable"; address?: string };

export type GapSnapshot = {
  ok: true;
  block: number;
  blockTime: number;
  readAt: number;
  window: number;
  index: {
    vault: string;
    supply: string;
    totalAssets: string; // raw 6 dec
    cash: string; // raw 6 dec
    nav: string; // 1e18, vault.convertToAssets(1e18) scaled
    navFromParts: string; // 1e18, recomputed from holdings x oracle prices + cash
    navUpdatedAt: number | null; // oldest constituent price time
    navOk: boolean;
    coverageOk: boolean;
    depositsPaused: boolean | null;
  };
  market: {
    found: boolean;
    checks: MarketCheck[];
    v4: { from: number; to: number; gaps: [number, number][]; pools: string[] };
  };
  basket: { twap: string | null; spot: string | null; gapTwapPpm: string | null; gapSpotPpm: string | null; oldestObservation: number | null; complete: boolean };
  legs: Leg[];
};

const pad32 = (a: string) => "0x" + a.toLowerCase().replace(/^0x/, "").padStart(64, "0");

/** v4 pools that use the index token, found from PoolManager Initialize logs since the index was deployed. */
async function v4Search(head: number) {
  const t = pad32(INDEX.vault);
  const as0 = await scanBack(logReader({ address: VENUES.v4PoolManager, topics: [V4_INITIALIZE_TOPIC, null, t] }), INDEX.deployBlock, head, { maxCalls: 12 });
  const as1 = await scanBack(logReader({ address: VENUES.v4PoolManager, topics: [V4_INITIALIZE_TOPIC, null, null, t] }), INDEX.deployBlock, head, { maxCalls: 12 });
  return {
    from: INDEX.deployBlock,
    to: head,
    gaps: [...as0.gaps, ...as1.gaps] as [number, number][],
    pools: [...as0.logs, ...as1.logs].map((l) => l.topics[1]),
  };
}

let v4Cache: { at: number; value: Awaited<ReturnType<typeof v4Search>> } | null = null;

/** Official stock-token proof per token: proxy codehash, beacon slot, supply > 0. */
async function proveStockTokens(tokens: string[]) {
  const calls = tokens.flatMap((t) => [
    { method: "eth_getCode", params: [t, "latest"] },
    { method: "eth_getStorageAt", params: [t, STOCK_TOKEN.beaconSlot, "latest"] },
  ]);
  const r = await rpcBatch<string>(calls).catch(() => calls.map(() => null));
  return tokens.map((_, i) => {
    const code = r[i * 2];
    const slot = r[i * 2 + 1];
    if (typeof code !== "string" || code.length <= 2 || typeof slot !== "string") return false;
    return keccak256(code as `0x${string}`) === STOCK_TOKEN.proxyCodehash && ("0x" + slot.slice(-40)).toLowerCase() === STOCK_TOKEN.beacon;
  });
}

export async function readGap(): Promise<GapSnapshot> {
  const blk = await rpc<{ number: string; timestamp: string }>("eth_getBlockByNumber", ["latest", false]);
  const block = Number(BigInt(blk.number));
  const blockTime = Number(BigInt(blk.timestamp));
  const V = INDEX.vault;
  const U = INDEX.asset;

  // 1. Index state + the market search for the index token itself.
  const directCalls: { venue: string; pair: string; call: Call }[] = [
    { venue: "Uniswap v2", pair: `index / ${INDEX.assetSymbol}`, call: { to: VENUES.v2Factory, abi: V2_FACTORY_ABI, fn: "getPair", args: [V, U] } },
    { venue: "Uniswap v2", pair: "index / WETH", call: { to: VENUES.v2Factory, abi: V2_FACTORY_ABI, fn: "getPair", args: [V, VENUES.weth] } },
    ...VENUES.v3Fees.flatMap((f) => [
      { venue: `Uniswap v3 ${f / 10_000}%`, pair: `index / ${INDEX.assetSymbol}`, call: { to: VENUES.v3Factory, abi: V3_FACTORY_ABI, fn: "getPool", args: [V, U, f] } as Call },
      { venue: `Uniswap v3 ${f / 10_000}%`, pair: "index / WETH", call: { to: VENUES.v3Factory, abi: V3_FACTORY_ABI, fn: "getPool", args: [V, VENUES.weth, f] } as Call },
    ]),
  ];
  const base: Call[] = [
    { to: V, abi: VAULT_ABI, fn: "totalSupply" },
    { to: V, abi: VAULT_ABI, fn: "totalAssets" },
    { to: V, abi: VAULT_ABI, fn: "convertToAssets", args: [E18] },
    { to: V, abi: VAULT_ABI, fn: "depositsPaused" },
    { to: INDEX.registry, abi: LIST_ABI, fn: "getActiveTokens" },
    { to: U, abi: ERC20_ABI, fn: "balanceOf", args: [V] },
    ...directCalls.map((d) => d.call),
  ];
  const r1 = await mc(base);
  const supply = r1[0] as bigint | null;
  const totalAssets = r1[1] as bigint | null;
  const navRaw = r1[2] as bigint | null;
  const tokens = (r1[4] as readonly string[] | null) ?? null;
  const cashRaw = r1[5] as bigint | null;
  if (supply === null || totalAssets === null || navRaw === null || tokens === null || cashRaw === null) throw new Error("index state unreadable");
  const checks: MarketCheck[] = directCalls.map((d, i) => {
    const v = r1[6 + i] as string | null;
    if (v === null) return { venue: d.venue, pair: d.pair, result: "unreadable" };
    return v.toLowerCase() === ZERO ? { venue: d.venue, pair: d.pair, result: "none" } : { venue: d.venue, pair: d.pair, result: "found", address: v };
  });

  // 2. Per constituent: token facts, oracle, feed config, candidate pools against the asset.
  const per = 7 + VENUES.v3Fees.length;
  const r2 = await mc(
    tokens.flatMap((t) => [
      { to: t, abi: ERC20_ABI, fn: "symbol" },
      { to: t, abi: ERC20_ABI, fn: "name" },
      { to: t, abi: ERC20_ABI, fn: "decimals" },
      { to: t, abi: ERC20_ABI, fn: "totalSupply" },
      { to: t, abi: ERC20_ABI, fn: "balanceOf", args: [V] },
      { to: INDEX.navOracle, abi: NAV_ORACLE_ABI, fn: "observe", args: [t] },
      { to: INDEX.navOracle, abi: NAV_ORACLE_ABI, fn: "getFeedConfig", args: [t] },
      ...VENUES.v3Fees.map((f) => ({ to: VENUES.v3Factory, abi: V3_FACTORY_ABI, fn: "getPool", args: [t, U, f] }) as Call),
    ]),
  );
  const proofs = await proveStockTokens([...tokens]);

  // 3. Every existing pool: orientation, spot, TWAP, depth, latest observation index.
  const poolList: { leg: number; address: string; fee: number }[] = [];
  tokens.forEach((_, i) =>
    VENUES.v3Fees.forEach((f, k) => {
      const p = r2[i * per + 7 + k] as string | null;
      if (p && p.toLowerCase() !== ZERO) poolList.push({ leg: i, address: p, fee: f });
    }),
  );
  const r3 = await mc(
    poolList.flatMap((p) => [
      { to: p.address, abi: V3_POOL_ABI, fn: "token0" },
      { to: p.address, abi: V3_POOL_ABI, fn: "slot0" },
      { to: p.address, abi: V3_POOL_ABI, fn: "observe", args: [[TWAP_WINDOW, 0]] },
      { to: U, abi: ERC20_ABI, fn: "balanceOf", args: [p.address] },
    ]),
  );
  const r4 = await mc(
    poolList.map((p, j) => {
      const s0 = r3[j * 4 + 1] as readonly [bigint, number, number] | null;
      return { to: p.address, abi: V3_POOL_ABI, fn: "observations", args: [BigInt(s0 ? s0[2] : 0)] } as Call;
    }),
  );

  // 4. Market search on v4 (logs), cached for 10 minutes; failures are never cached.
  let v4 = v4Cache && Date.now() - v4Cache.at < 600_000 ? v4Cache.value : null;
  if (!v4) {
    try {
      v4 = await v4Search(block);
      if (v4.gaps.length === 0) v4Cache = { at: Date.now(), value: v4 };
    } catch {
      v4 = { from: INDEX.deployBlock, to: block, gaps: [[INDEX.deployBlock, block]], pools: [] };
    }
  }

  // 5. Assemble.
  const assetDec = INDEX.assetDecimals;
  const cash1e18 = to1e18(cashRaw, assetDec);
  let sumOracle = 0n;
  let sumPool = 0n;
  let sumSpot = 0n;
  let complete = tokens.length > 0;
  let oldestObs: number | null = null;
  let navUpdatedAt: number | null = null;
  let navOk = tokens.length > 0;
  const legs: Leg[] = tokens.map((t, i) => {
    const o = (k: number) => r2[i * per + k];
    const decimals = Number((o(2) as number | null) ?? 18);
    const balance = (o(4) as bigint | null) ?? 0n;
    const obs = o(5) as readonly [bigint, bigint, boolean] | null;
    const cfg = o(6) as readonly [string, bigint, bigint] | null;
    const supplyT = (o(3) as bigint | null) ?? 0n;
    const proven = proofs[i] && supplyT > 0n;
    const symbol = (o(0) as string | null) ?? null;
    const name = (o(1) as string | null) ?? null;
    const company = proven && name ? name.replace(/\s*•\s*Robinhood Token\s*$/, "") : null;
    const unit = 10n ** BigInt(decimals);
    const oracle = obs ? { price: obs[0].toString(), updatedAt: Number(obs[1]), ok: obs[2], feed: cfg ? cfg[0] : null, heartbeat: cfg ? Number(cfg[1]) : null } : null;
    if (!obs || !obs[2]) navOk = false;
    if (obs) navUpdatedAt = navUpdatedAt === null ? Number(obs[1]) : Math.min(navUpdatedAt, Number(obs[1]));
    const valueOracle = obs ? (balance * obs[0]) / unit : 0n;
    sumOracle += valueOracle;

    const pools: PoolRead[] = poolList
      .map((p, j) => ({ p, j }))
      .filter(({ p }) => p.leg === i)
      .map(({ p, j }) => {
        const token0 = r3[j * 4] as string | null;
        const s0 = r3[j * 4 + 1] as readonly [bigint, number] | null;
        const ob = r3[j * 4 + 2] as readonly [readonly bigint[], readonly bigint[]] | null;
        const depth = (r3[j * 4 + 3] as bigint | null) ?? 0n;
        const last = r4[j] as readonly [number, bigint, bigint, boolean] | null;
        const base0 = token0 ? token0.toLowerCase() === t.toLowerCase() : false;
        const spot = s0 && token0 && s0[0] > 0n ? priceFromSqrt(s0[0], base0, decimals, assetDec) : null;
        const tw = ob && token0 ? twapPrice(ob[0][0], ob[0][1], TWAP_WINDOW, base0, decimals, assetDec) : null;
        return { address: p.address, fee: p.fee, baseIsToken0: base0, depth: depth.toString(), spot: spot?.toString() ?? null, twap: tw?.price.toString() ?? null, twapTick: tw?.tick ?? null, lastObservation: last ? Number(last[0]) : null };
      });
    // The leg's pool: the deepest (most asset held) pool whose 30-minute TWAP reads.
    const pool = [...pools].filter((p) => p.twap !== null).sort((a, b) => (BigInt(b.depth) > BigInt(a.depth) ? 1 : -1))[0] ?? null;
    let valuePool: bigint | null = null;
    let legGap: bigint | null = null;
    if (pool && pool.twap) {
      valuePool = (balance * BigInt(pool.twap)) / unit;
      sumPool += valuePool;
      sumSpot += (balance * BigInt(pool.spot ?? pool.twap)) / unit;
      if (obs && obs[0] > 0n) legGap = gapPpm(BigInt(pool.twap), obs[0]);
      if (pool.lastObservation !== null) oldestObs = oldestObs === null ? pool.lastObservation : Math.min(oldestObs, pool.lastObservation);
    } else {
      complete = false;
    }
    return {
      token: t,
      proven,
      ticker: proven ? symbol : null,
      company,
      decimals,
      balance: balance.toString(),
      oracle,
      pools,
      pool,
      valueOracle: valueOracle.toString(),
      valuePool: valuePool?.toString() ?? null,
      gapPpm: legGap?.toString() ?? null,
    };
  });

  const nav = to1e18(navRaw, assetDec);
  const ta1e18 = to1e18(totalAssets, assetDec);
  const partsTotal = sumOracle + cash1e18;
  const diff = partsTotal > ta1e18 ? partsTotal - ta1e18 : ta1e18 - partsTotal;
  const coverageOk = ta1e18 > 0n && diff * 1_000_000n <= ta1e18 * 1_000n;
  const per1 = (v: bigint) => (supply > 0n ? (v * E18) / supply : 0n);
  const basketTwap = complete && supply > 0n ? per1(sumPool + cash1e18) : null;
  const basketSpot = complete && supply > 0n ? per1(sumSpot + cash1e18) : null;

  return {
    ok: true,
    block,
    blockTime,
    readAt: Date.now(),
    window: TWAP_WINDOW,
    index: {
      vault: V,
      supply: supply.toString(),
      totalAssets: totalAssets.toString(),
      cash: cashRaw.toString(),
      nav: nav.toString(),
      navFromParts: per1(partsTotal).toString(),
      navUpdatedAt,
      navOk,
      coverageOk,
      depositsPaused: (r1[3] as boolean | null) ?? null,
    },
    market: { found: checks.some((c) => c.result === "found") || v4.pools.length > 0, checks, v4 },
    basket: {
      twap: basketTwap?.toString() ?? null,
      spot: basketSpot?.toString() ?? null,
      gapTwapPpm: basketTwap !== null && nav > 0n ? gapPpm(basketTwap, nav).toString() : null,
      gapSpotPpm: basketSpot !== null && nav > 0n ? gapPpm(basketSpot, nav).toString() : null,
      oldestObservation: oldestObs,
      complete,
    },
    legs,
  };
}

/** Cache: one refresh at a time, a fresh answer for 30 s, the last complete answer served for at most 10 minutes. Failures are never stored. */
let last: { at: number; value: GapSnapshot } | null = null;
let flying: Promise<GapSnapshot> | null = null;
export async function gapSnapshot(): Promise<{ value: GapSnapshot; ageMs: number } | null> {
  if (last && Date.now() - last.at < 30_000) return { value: last.value, ageMs: Date.now() - last.at };
  flying ??= readGap().finally(() => {
    flying = null;
  });
  try {
    const value = await flying;
    last = { at: Date.now(), value };
    return { value, ageMs: 0 };
  } catch {
    if (last && Date.now() - last.at < 600_000) return { value: last.value, ageMs: Date.now() - last.at };
    return null;
  }
}
