import { test } from "node:test";
import assert from "node:assert/strict";

// A local endpoint keeps the client on this one URL (no public fallback), so the fake fetch below sees every call.
process.env.ROBINHOOD_RPC_URL = "http://127.0.0.1:1";

test("a rate limit inside a 200 answer is retried, not taken as a failed read (F-05)", async () => {
  const { isBusyBody, rpc, rpcCapped } = await import("./feeds/rpc");
  assert.equal(isBusyBody({ jsonrpc: "2.0", error: { code: 429, message: "Too Many Requests" } }), true);
  assert.equal(isBusyBody({ jsonrpc: "2.0", error: { code: -32000, message: "execution reverted" } }), false);
  const real = globalThis.fetch;
  let n = 0;
  globalThis.fetch = (async () => {
    n++;
    const body = n < 3 ? { jsonrpc: "2.0", id: 1, error: { code: 429, message: "Too Many Requests" } } : { jsonrpc: "2.0", id: 1, result: "0x10" };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    assert.equal(await rpc<string>("eth_blockNumber", []), "0x10");
    assert.equal(n, 3);
    n = 0;
    assert.equal(await rpcCapped<string>("eth_getLogs", [{}], 10_000, () => new Error("too large")), "0x10");
    assert.equal(n, 3);
  } finally {
    globalThis.fetch = real;
  }
});
