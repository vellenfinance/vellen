import "server-only";
import { decodeFunctionResult, encodeFunctionData } from "viem";
import { FEEDS } from "@/config/chaindata";
import { CONTRACTS, watchLive } from "@/config/contracts";
import { FEED_ABI } from "@/lib/abi";
import { rpcBatch } from "@/lib/server/chainread";

/* Light live facts for every page: head block, its time, block time over the last 100,000 blocks, gas price, Chainlink ETH/USD, and whether the watch contract has code. */

export type ChainSnapshot = {
  block: number | null;
  time: number | null;
  blockSeconds: number | null;
  gasPriceWei: string | null;
  ethUsd: { price: number; updatedAt: number; feed: string } | null;
  watchCode: boolean | null;
  readAt: number;
};

const SPAN = 100_000;

export async function readSnapshot(): Promise<ChainSnapshot> {
  const feed = FEEDS[0];
  const head = await rpcBatch<unknown>([{ method: "eth_getBlockByNumber", params: ["latest", false] }]).catch(() => [null]);
  const blk = head[0] as { number?: string; timestamp?: string } | null;
  const n = blk?.number ? Number(BigInt(blk.number)) : null;
  const calls = [
    { method: "eth_gasPrice", params: [] },
    { method: "eth_call", params: [{ to: feed.address, data: encodeFunctionData({ abi: FEED_ABI, functionName: "latestRoundData" }) }, "latest"] },
    ...(n !== null ? [{ method: "eth_getBlockByNumber", params: [`0x${Math.max(0, n - SPAN).toString(16)}`, false] }] : []),
    ...(watchLive() ? [{ method: "eth_getCode", params: [CONTRACTS.watch, "latest"] }] : []),
  ];
  const r = await rpcBatch<unknown>(calls).catch(() => calls.map(() => null));
  const time = blk?.timestamp ? Number(BigInt(blk.timestamp)) : null;
  let ethUsd: ChainSnapshot["ethUsd"] = null;
  try {
    if (typeof r[1] === "string" && r[1].length > 2) {
      const [, answer, , updatedAt] = decodeFunctionResult({ abi: FEED_ABI, functionName: "latestRoundData", data: r[1] as `0x${string}` });
      if (answer > 0n) ethUsd = { price: Number(answer) / 10 ** feed.decimals, updatedAt: Number(updatedAt), feed: feed.address };
    }
  } catch {
    ethUsd = null;
  }
  const old = n !== null ? (r[2] as { timestamp?: string } | null) : null;
  const blockSeconds = time !== null && old?.timestamp ? (time - Number(BigInt(old.timestamp))) / SPAN : null;
  const has = (x: unknown) => typeof x === "string" && x.length > 2;
  return {
    block: n,
    time,
    blockSeconds,
    gasPriceWei: typeof r[0] === "string" ? BigInt(r[0]).toString() : null,
    ethUsd,
    watchCode: watchLive() ? has(r[n !== null ? 3 : 2]) : null,
    readAt: Date.now(),
  };
}
