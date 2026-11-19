import "server-only";
import { decodeFunctionResult, encodeFunctionData } from "viem";
import { DEPOSIT_TOPIC, INDEX, TWAP_WINDOW, WITHDRAW_TOPIC } from "@/config/index";
import { ERC20_ABI, LIST_ABI, VAULT_ABI, V3_POOL_ABI } from "@/lib/abi";
import { archiveCall } from "@/lib/feeds/rpc";
import { gapPpm, to1e18, twapPrice } from "@/lib/gap/math";
import { scanBack } from "@/lib/logscan";
import { blockTime, logReader } from "@/lib/server/chainread";
import type { GapSnapshot } from "@/lib/server/gap";

/*
 * History that can be proven from chain:
 *  - executions: every mint (Deposit) and redeem (Withdraw) of the index token, with the price it executed at
 *    (assets / shares from the event) against NAV read at the block before (archive read);
 *  - samples: NAV per token and the basket at pool TWAPs at evenly spaced blocks since the index was deployed
 *    (archive reads; constituents and leg pools are taken from the live reading, so a sample before a constituent change
 *    is marked when the list then differed).
 */

export type Execution = { kind: "mint" | "redeem"; block: number; time: number | null; tx: string; assets: string; shares: string; price: string; navBefore: string | null; gapPpm: string | null };
export type Sample = { block: number; time: number | null; nav: string | null; basket: string | null; gapPpm: string | null; listChanged: boolean };
export type GapHistory = { ok: true; from: number; to: number; gaps: [number, number][]; executions: Execution[]; samples: Sample[]; readAt: number; archive: boolean };

const E18 = 10n ** 18n;
const word = (hex: string, i: number) => BigInt("0x" + hex.slice(2 + i * 64, 2 + (i + 1) * 64));

async function call<T>(to: string, abi: never, fn: string, args: readonly unknown[], block: number): Promise<T | null> {
  try {
    const raw = await archiveCall(to, encodeFunctionData({ abi, functionName: fn, args } as never), block);
    return decodeFunctionResult({ abi, functionName: fn, data: raw as `0x${string}` } as never) as T;
  } catch {
    return null;
  }
}

async function navAt(block: number): Promise<bigint | null> {
  const v = await call<bigint>(INDEX.vault, VAULT_ABI as never, "convertToAssets", [E18], block);
  return v === null ? null : to1e18(v, INDEX.assetDecimals);
}

async function basketAt(block: number, snap: GapSnapshot): Promise<{ value: bigint | null; listChanged: boolean }> {
  const list = await call<readonly string[]>(INDEX.registry, LIST_ABI as never, "getActiveTokens", [], block);
  const live = snap.legs.map((l) => l.token.toLowerCase());
  const listChanged = !list || list.length !== live.length || list.some((t) => !live.includes(t.toLowerCase()));
  if (listChanged) return { value: null, listChanged: true };
  const [supply, cash] = await Promise.all([
    call<bigint>(INDEX.vault, VAULT_ABI as never, "totalSupply", [], block),
    call<bigint>(INDEX.asset, ERC20_ABI as never, "balanceOf", [INDEX.vault], block),
  ]);
  if (!supply || cash === null) return { value: null, listChanged: false };
  let sum = to1e18(cash, INDEX.assetDecimals);
  for (const leg of snap.legs) {
    if (!leg.pool) return { value: null, listChanged: false };
    const [bal, ob] = await Promise.all([
      call<bigint>(leg.token, ERC20_ABI as never, "balanceOf", [INDEX.vault], block),
      call<readonly [readonly bigint[], readonly bigint[]]>(leg.pool.address, V3_POOL_ABI as never, "observe", [[TWAP_WINDOW, 0]], block),
    ]);
    if (bal === null || !ob) return { value: null, listChanged: false };
    const px = twapPrice(ob[0][0], ob[0][1], TWAP_WINDOW, leg.pool.baseIsToken0, leg.decimals, INDEX.assetDecimals).price;
    sum += (bal * px) / 10n ** BigInt(leg.decimals);
  }
  return { value: (sum * E18) / supply, listChanged: false };
}

/** Limits the archive endpoint sees: a few reads at a time. */
async function pool<T, R>(items: T[], n: number, f: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await f(items[k]);
      }
    }),
  );
  return out;
}

export async function readHistory(snap: GapSnapshot, samples = 36): Promise<GapHistory> {
  const head = snap.block;
  // One topic value per query: the official RPC allows only 100,000 blocks for a query with an OR list in a topic position.
  const dep = await scanBack(logReader({ address: INDEX.vault, topics: [DEPOSIT_TOPIC] }), INDEX.deployBlock, head, { maxCalls: 20 });
  const wd = await scanBack(logReader({ address: INDEX.vault, topics: [WITHDRAW_TOPIC] }), INDEX.deployBlock, head, { maxCalls: 20 });
  const scan = { gaps: [...dep.gaps, ...wd.gaps] };
  const logs = [...dep.logs, ...wd.logs].sort((x, y) => Number(BigInt(x.blockNumber) - BigInt(y.blockNumber)) || Number(BigInt(x.logIndex) - BigInt(y.logIndex)));

  const executions: Execution[] = await pool(logs, 3, async (l) => {
    const isMint = l.topics[0] === DEPOSIT_TOPIC;
    const assets = word(l.data, 0);
    const shares = word(l.data, 1);
    const block = Number(BigInt(l.blockNumber));
    const price = shares > 0n ? (to1e18(assets, INDEX.assetDecimals) * E18) / shares : 0n;
    const [navBefore, time] = await Promise.all([navAt(block - 1), blockTime(block)]);
    return {
      kind: isMint ? "mint" : "redeem",
      block,
      time,
      tx: l.transactionHash,
      assets: assets.toString(),
      shares: shares.toString(),
      price: price.toString(),
      navBefore: navBefore?.toString() ?? null,
      gapPpm: navBefore && navBefore > 0n ? gapPpm(price, navBefore).toString() : null,
    };
  });

  // Evenly spaced blocks from deployment (+1 window so a TWAP exists) to head.
  const start = INDEX.deployBlock + 20_000;
  const step = Math.max(1, Math.floor((head - start) / Math.max(1, samples - 1)));
  const blocks = Array.from({ length: samples }, (_, k) => Math.min(head, start + k * step));
  let archive = true;
  const sampleRows: Sample[] = await pool(blocks, 3, async (b) => {
    const [nav, basket, time] = await Promise.all([navAt(b), basketAt(b, snap), blockTime(b)]);
    if (nav === null) archive = false;
    return {
      block: b,
      time,
      nav: nav?.toString() ?? null,
      basket: basket.value?.toString() ?? null,
      gapPpm: nav && basket.value ? gapPpm(basket.value, nav).toString() : null,
      listChanged: basket.listChanged,
    };
  });
  return { ok: true, from: INDEX.deployBlock, to: head, gaps: scan.gaps as [number, number][], executions, samples: sampleRows, readAt: Date.now(), archive };
}

