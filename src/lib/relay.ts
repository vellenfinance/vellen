import { BRAND, isAddress } from "@/config/brand";
import { CONTRACTS } from "@/config/contracts";
import { FEEDS, TOKENS } from "@/config/chaindata";
import { INDEX } from "@/config/index";

/*
 * Rules for the JSON-RPC relay, kept apart from the route so they can be tested. Every request is priced in units; each network
 * has a budget and the whole site has a ceiling. Only the request shapes the site itself issues pass:
 *   - eth_call to the contracts the site reads (VellenGapWatch, the index token, its constituent list and price oracle, USDG,
 *     the Chainlink ETH/USD feed, $VELLEN), or to
 *     ANY address when the call is one of a few plain read functions with a low gas cap (token balance, symbol, decimals, allowance);
 *   - eth_estimateGas for VellenGapWatch (open track, set legs, record checkpoint, register rule, fire) or a plain ETH transfer;
 *   - nothing is ever sent: transactions go from the visitor's own wallet. No eth_getLogs: scans run on the server.
 */

export const MAX_CALLS = 20;
export const MAX_GAS = 5_000_000;
/** Gas cap for a read sent to an address the site does not know. */
export const MAX_FOREIGN_GAS = 200_000;
export const MAX_BODY = 360_000;
export const BUDGET = { units: 2_000, windowSec: 600, siteUnits: 40_000 };
/** Call data limit in hex characters. The largest call the site sends is setLegs with 32 legs (about 4,300). */
export const MAX_CALL_DATA = 8_000;

const GAS_CAP_HEX = `0x${MAX_GAS.toString(16)}`;
const FOREIGN_GAS_HEX = `0x${MAX_FOREIGN_GAS.toString(16)}`;
const CALL_KEYS = new Set(["from", "to", "gas", "gasPrice", "maxFeePerGas", "maxPriorityFeePerGas", "value", "data", "input", "nonce", "type", "chainId"]);
const BLOCK_TAG = /^(latest|pending|safe|finalized|0x[0-9a-fA-F]{1,16})$/;

/** Read functions any address may answer: selector => largest call data in hex characters. */
export const READ_SELECTORS: Record<string, number> = {
  "0x95d89b41": 2 + 8, // symbol()
  "0x313ce567": 2 + 8, // decimals()
  "0x06fdde03": 2 + 8, // name()
  "0x18160ddd": 2 + 8, // totalSupply()
  "0x8da5cb5b": 2 + 8, // owner()
  "0x0dfe1681": 2 + 8, // token0()
  "0xd21220a7": 2 + 8, // token1()
  "0x0902f1ac": 2 + 8, // getReserves()
  "0xddca3f43": 2 + 8, // fee()
  "0xd0c93a7c": 2 + 8, // tickSpacing()
  "0x3850c7bd": 2 + 8, // slot0()
  "0x1a686502": 2 + 8, // liquidity()
  "0x70a08231": 2 + 8 + 64, // balanceOf(address)
  "0xdd62ed3e": 2 + 8 + 128, // allowance(address,address)
  "0x7ecebe00": 2 + 8 + 64, // nonces(address)
  "0x3644e515": 2 + 8, // DOMAIN_SEPARATOR()
  "0x54fd4d50": 2 + 8, // version()
  "0xe985e9c5": 2 + 8 + 128, // isApprovedForAll(address,address)
};

/** True when `data` is one of the plain reads above, within its size. */
export function isPlainRead(data: unknown): boolean {
  if (typeof data !== "string" || !/^0x[0-9a-fA-F]*$/.test(data) || data.length < 10) return false;
  const max = READ_SELECTORS[data.slice(0, 10).toLowerCase()];
  return max !== undefined && data.length <= max;
}

/**
 * Normalises a call object before it is checked and forwarded. The node reads `input` as well as `data`, so `input` is folded into `data`
 * (refused when the two disagree) and every check sees the bytes that will run; a call without `gas` gets the relay cap.
 */
function shapeTx(tx: Record<string, unknown>, cap = GAS_CAP_HEX, allowValue = false): string | null {
  // The node decodes field names case-insensitively ("TO" would override "to"), so only these exact names pass.
  for (const k of Object.keys(tx)) if (!CALL_KEYS.has(k)) return `Unsupported call field: ${k.slice(0, 32)}`;
  if (tx.input !== undefined) {
    if (tx.data !== undefined && tx.data !== tx.input) return "data and input disagree.";
    tx.data = tx.input;
    delete tx.input;
  }
  if (tx.data !== undefined && (typeof tx.data !== "string" || !/^0x[0-9a-fA-F]*$/.test(tx.data))) return "Call data must be hex.";
  if (tx.value !== undefined) {
    if (typeof tx.value !== "string" || !/^0x[0-9a-fA-F]{1,64}$/.test(tx.value)) return "Value must be hex.";
    if (!allowValue && !/^0x0*$/.test(tx.value)) return "Calls with value are not relayed.";
  }
  if (tx.gas === undefined) tx.gas = cap;
  return null;
}

export const COST: Record<string, number> = {
  eth_call: 2,
  eth_getTransactionReceipt: 1,
  eth_getTransactionByHash: 1,
  eth_blockNumber: 1,
  eth_getBalance: 1,
  eth_chainId: 1,
  eth_gasPrice: 1,
  eth_getBlockByNumber: 1,
  eth_getTransactionCount: 1,
  eth_maxPriorityFeePerGas: 1,
  eth_getCode: 1,
  eth_estimateGas: 3,
};

/** Contracts the browser reads through the relay by address. eth_getCode and receipts are answered for any address. */
export function readTargets() {
  const list: string[] = [];
  if (isAddress(BRAND.ca)) list.push(BRAND.ca);
  if (isAddress(CONTRACTS.watch)) list.push(CONTRACTS.watch);
  list.push(INDEX.vault, INDEX.registry, INDEX.navOracle);
  for (const t of TOKENS) list.push(t.address);
  for (const f of FEEDS) list.push(f.address);
  return new Set(list.map((a) => a.toLowerCase()));
}

export type Call = { jsonrpc?: string; id?: unknown; method: string; params?: unknown[] };

const gasOf = (g: unknown) => (typeof g === "string" && /^0x[0-9a-fA-F]{1,16}$/.test(g) ? Number(BigInt(g)) : Infinity);

/** Checks a batch and returns its cost in units, or the reason it is refused. */
export function checkBatch(calls: Call[], targets = readTargets()): { units: number } | { error: string } {
  if (calls.length === 0 || calls.length > MAX_CALLS) return { error: `Between 1 and ${MAX_CALLS} calls per request.` };
  let units = 0;
  for (const c of calls) {
    if (!c || typeof c.method !== "string" || !Object.hasOwn(COST, c.method)) return { error: `Method not allowed: ${String(c?.method)}` };
    if (c.params !== undefined && !Array.isArray(c.params)) return { error: "params must be an array." };
    const params = c.params ?? [];
    units += COST[c.method];
    if (c.method === "eth_call" || c.method === "eth_estimateGas") {
      if (params.length > 2) return { error: "State overrides are not relayed." };
      const tx = params[0] as { to?: unknown; gas?: unknown; data?: unknown; value?: unknown } | undefined;
      if (!tx || typeof tx !== "object" || typeof tx.to !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(tx.to)) return { error: `${c.method} needs a target address.` };
      const to = tx.to.toLowerCase();
      const known = targets.has(to);
      const data = (tx as { data?: unknown; input?: unknown }).data ?? (tx as { input?: unknown }).input;
      const d0 = typeof data === "string" ? data.toLowerCase() : "0x";
      let foreign = false;
      if (c.method === "eth_call") {
        foreign = !known && isPlainRead(data);
        if (!known && !foreign) return { error: "eth_call target not served by this relay." };
      } else {
        // Estimates: our contracts or a plain ETH transfer.
        const plainSend = d0 === "0x" || d0 === "";
        if (!known && !plainSend) return { error: "eth_estimateGas target not served by this relay." };
        foreign = !known;
      }
      const allowValue = c.method === "eth_estimateGas";
      const shaped = shapeTx(tx as Record<string, unknown>, foreign ? FOREIGN_GAS_HEX : GAS_CAP_HEX, allowValue);
      if (shaped) return { error: shaped };
      if (params[1] !== undefined && !(typeof params[1] === "string" && BLOCK_TAG.test(params[1]))) return { error: "Unsupported block tag." };
      if (gasOf(tx.gas) > (foreign ? MAX_FOREIGN_GAS : MAX_GAS)) return { error: "Gas above the relay cap." };
      const dd = typeof tx.data === "string" ? tx.data : "0x";
      if (dd.length > MAX_CALL_DATA) return { error: "Call data too large." };
    }
    if (c.method === "eth_getBlockByNumber" && params[1] !== false) return { error: "eth_getBlockByNumber is relayed only with full transactions off (false)." };
  }
  return { units };
}

export type RpcAnswer = { result: unknown } | { error: { code: number; message: string; data?: string } } | { down: true };

export type RelayDeps = {
  /** Charges the caller's budgets; returns the refusal message, or null when allowed. */
  charge: (units: number) => Promise<string | null>;
  one: (method: string, params: unknown[]) => Promise<RpcAnswer>;
  many: (calls: { method: string; params: unknown[] }[]) => Promise<(unknown | null)[]>;
};

/** Addresses a batch reads, lowercased, so a refused target can still be priced. */
export function namedAddresses(body: Call | Call[]): string[] {
  const calls = Array.isArray(body) ? body : [body];
  const out = new Set<string>();
  for (const c of calls) {
    if (!c || !Array.isArray(c.params)) continue;
    const first = c.params[0] as { to?: unknown } | undefined;
    if (first && typeof first === "object" && (c.method === "eth_call" || c.method === "eth_estimateGas") && typeof first.to === "string") out.add(first.to.toLowerCase());
  }
  return [...out].filter((a) => /^0x[0-9a-f]{40}$/.test(a));
}

/**
 * The relay's whole decision, without I/O of its own: shape and price first, then the budget, then
 * the target allowlist, and only then the upstream RPC. A refused request never reaches the RPC.
 */
export async function runRelay(body: Call | Call[], deps: RelayDeps): Promise<{ status: number; body: unknown }> {
  const calls = Array.isArray(body) ? body : [body];
  const targets = readTargets();
  // Priced with every named address allowed first, so a refused target still costs budget.
  // Priced on a copy: checkBatch fills in a missing gas cap, and the pricing pass treats every target as known (the larger cap).
  const priced = checkBatch(JSON.parse(JSON.stringify(calls)) as Call[], new Set([...targets, ...namedAddresses(body)]));
  if ("error" in priced) return { status: 400, body: { error: priced.error } };
  // Also price the strict pass (real targets only) and charge the larger, so no allowlist path is cheaper than it should be.
  const strict = checkBatch(JSON.parse(JSON.stringify(calls)) as Call[], targets);
  const units = "error" in strict ? priced.units : Math.max(priced.units, strict.units);
  const refused = await deps.charge(units);
  if (refused) return { status: 429, body: { error: refused } };
  const checked = checkBatch(calls, targets);
  if ("error" in checked) return { status: 400, body: { error: checked.error } };
  if (calls.length === 1 && !Array.isArray(body)) {
    const c = calls[0];
    const a = await deps.one(c.method, c.params ?? []);
    if ("down" in a) return { status: 502, body: { error: "The chain could not be reached." } };
    return { status: 200, body: { jsonrpc: "2.0", id: c.id ?? null, ...a } };
  }
  try {
    const results = await deps.many(calls.map((c) => ({ method: c.method, params: c.params ?? [] })));
    const out = calls.map((c, i) => (results[i] === null ? { jsonrpc: "2.0", id: c.id ?? null, error: { code: -32000, message: "read failed" } } : { jsonrpc: "2.0", id: c.id ?? null, result: results[i] }));
    return { status: 200, body: Array.isArray(body) ? out : out[0] };
  } catch {
    return { status: 502, body: { error: "The chain could not be reached." } };
  }
}
