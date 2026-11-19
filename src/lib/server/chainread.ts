import "server-only";
import { decodeFunctionResult, encodeFunctionData, type Abi } from "viem";
import { RpcError, rpc, rpcBatch, rpcBatchAnswers, rpcCapped } from "@/lib/feeds/rpc";
import type { Reader } from "@/lib/logscan";

/* Small helpers over the RPC layer: typed reads that tell a revert from an outage, a TTL cache, and the log reader. */

export type Read = { to: string; abi: Abi; fn: string; args?: readonly unknown[] };
export type Answer<T = unknown> = { kind: "ok"; value: T } | { kind: "revert" } | { kind: "failed" };

const enc = (r: Read) => encodeFunctionData({ abi: r.abi, functionName: r.fn, args: r.args ?? [] } as never);
const dec = (r: Read, raw: string): unknown => {
  try {
    return raw && raw.length > 2 ? decodeFunctionResult({ abi: r.abi, functionName: r.fn, data: raw as `0x${string}` } as never) : undefined;
  } catch {
    return undefined;
  }
};

/** Several reads in one batch. A read that answers but does not decode counts as a revert (the function is not there). */
export async function reads(list: Read[]): Promise<Answer[]> {
  // The target may be any address a visitor pasted, so each read only gets 200,000 gas.
  const r = await rpcBatchAnswers(list.map((x) => ({ method: "eth_call", params: [{ to: x.to, data: enc(x), gas: "0x30d40" }, "latest"] })));
  return r.map((a, i) => {
    if (a.kind !== "ok") return a;
    const v = dec(list[i], a.result as string);
    return v === undefined ? { kind: "revert" } : { kind: "ok", value: v };
  });
}

export const headBlock = async () => Number(BigInt(await rpc<string>("eth_blockNumber", [])));

/** One read at a time per key, an answer kept for `ttl`, and a recent good answer kept when a refresh fails. */
export function memo<T>(ttl: number, read: (key: string) => Promise<T>, max = 500) {
  const cache = new Map<string, { at: number; value: T }>();
  const flying = new Map<string, Promise<T>>();
  return async (key: string): Promise<T> => {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttl) return hit.value;
    const busy = flying.get(key);
    if (busy) return busy;
    const p = read(key)
      .then((value) => {
        if (cache.size >= max) cache.clear();
        cache.set(key, { at: Date.now(), value });
        return value;
      })
      .catch((e) => {
        if (hit) return hit.value;
        throw e;
      })
      .finally(() => flying.delete(key));
    flying.set(key, p);
    return p;
  };
}

export type RawLog = { address: string; topics: string[]; data: string; blockNumber: string; transactionHash: string; logIndex: string };

/** A log reader for scanBack: a proven size or range refusal is "too-large"; anything else (rate limit, outage) is "failed". */
export function logReader(filter: { address?: string | string[]; topics: (string | string[] | null)[] }, maxBytes = 1_500_000): Reader<RawLog> {
  return async (from, to) => {
    try {
      const logs = await rpcCapped<RawLog[]>("eth_getLogs", [{ ...filter, fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}` }], maxBytes, () => new RpcError("too large", true));
      return Array.isArray(logs) ? { ok: true, logs } : { ok: false, error: { kind: "failed", message: "malformed answer" } };
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      // Only a refusal that names the size of the query may be split; a plain "exceeded" can be a rate limit.
      const sized = e instanceof RpcError && e.revert && /too large|spans|range|10000 results|more than|limit of \d+|exceeds limit|query returned more/i.test(m) && !/rate|requests per|too many requests/i.test(m);
      return { ok: false, error: sized ? { kind: "too-large" } : { kind: "failed", message: m.slice(0, 160) } };
    }
  };
}

export async function blockTime(block: number): Promise<number | null> {
  try {
    const b = await rpc<{ timestamp: string } | null>("eth_getBlockByNumber", [`0x${block.toString(16)}`, false]);
    return b ? Number(BigInt(b.timestamp)) : null;
  } catch {
    return null;
  }
}

export { rpc, rpcBatch };

// ------------------------------------------------------------------ Multicall3

/** Multicall3 at its usual address; code confirmed on Robinhood Chain on 11 Nov 2026. */
export const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const MC_ABI = [
  {
    type: "function",
    name: "aggregate3",
    stateMutability: "payable",
    inputs: [{ name: "calls", type: "tuple[]", components: [{ name: "target", type: "address" }, { name: "allowFailure", type: "bool" }, { name: "callData", type: "bytes" }] }],
    outputs: [{ name: "returnData", type: "tuple[]", components: [{ name: "success", type: "bool" }, { name: "returnData", type: "bytes" }] }],
  },
] as const satisfies Abi;

/**
 * Many plain reads in one eth_call (one request against the node's rate limit instead of one per read). Each answer is
 * the raw return data, or null when that call failed or the whole chunk could not be read.
 */
export async function multicall(calls: { to: string; data: string }[], chunk = 120): Promise<(string | null)[]> {
  const out: (string | null)[] = calls.map(() => null);
  for (let i = 0; i < calls.length; i += chunk) {
    const part = calls.slice(i, i + chunk);
    const data = encodeFunctionData({ abi: MC_ABI, functionName: "aggregate3", args: [part.map((c) => ({ target: c.to as `0x${string}`, allowFailure: true, callData: c.data as `0x${string}` }))] });
    try {
      const raw = await rpc<string>("eth_call", [{ to: MULTICALL3, data, gas: `0x${(part.length * 250_000).toString(16)}` }, "latest"]);
      const res = decodeFunctionResult({ abi: MC_ABI, functionName: "aggregate3", data: raw as `0x${string}` }) as readonly { success: boolean; returnData: string }[];
      res.forEach((r, k) => {
        out[i + k] = r.success && r.returnData.length > 2 ? r.returnData : null;
      });
    } catch {
      // this chunk stays null
    }
  }
  return out;
}
