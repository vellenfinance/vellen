import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_CALL_DATA, MAX_FOREIGN_GAS, checkBatch, isPlainRead, readTargets, runRelay } from "./relay";
// Before deployment the relay knows USDG and the ETH/USD feed only; tests pass their own known target too.
const USDG = { address: "0x5fc5360d0400a0fd4f2af552add042d716f1d168" };
const KNOWN = new Set([...readTargets(), USDG.address]);

const call = (to: string, data = "0x", extra: Record<string, unknown> = {}) => ({ method: "eth_call", params: [{ to, data, ...extra }, "latest"] });
const STRANGER = "0x000000000000000000000000000000000000dead";

test("reads of known contracts are priced", () => {
  const out = checkBatch([call(USDG.address, "0x18160ddd")], KNOWN);
  assert.ok("units" in out && out.units === 2);
});

test("log queries, unknown calls and signed transactions are refused", () => {
  assert.ok("error" in checkBatch([call(STRANGER)]));
  assert.ok("error" in checkBatch([call(STRANGER, "0xa9059cbb" + "0".repeat(128))]));
  assert.ok("error" in checkBatch([{ method: "eth_sendRawTransaction", params: ["0x02f8"] }]));
  assert.ok("error" in checkBatch([{ method: "eth_getLogs", params: [{ address: USDG.address, fromBlock: "0x1", toBlock: "0x2" }] }]));
});

test("a plain read of any address is allowed, with a low gas cap", () => {
  const tx = { to: STRANGER, data: "0x06fdde03" } as Record<string, unknown>;
  assert.ok("units" in checkBatch([{ method: "eth_call", params: [tx, "latest"] }]));
  assert.equal(Number(BigInt(tx.gas as string)), MAX_FOREIGN_GAS);
  assert.ok("error" in checkBatch([call(STRANGER, "0x06fdde03", { gas: "0xffffff" })]));
  assert.equal(isPlainRead("0x70a08231" + "0".repeat(64)), true);
  assert.equal(isPlainRead("0x70a08231" + "0".repeat(66)), false);
});

test("no state overrides, odd fields, value or input tricks", () => {
  assert.ok("error" in checkBatch([{ method: "eth_call", params: [{ to: USDG.address, data: "0x" }, "latest", {}] }], KNOWN));
  assert.ok("error" in checkBatch([call(USDG.address, "0x", { TO: STRANGER })], KNOWN));
  assert.ok("error" in checkBatch([call(USDG.address, "0x", { value: "0x1" })], KNOWN));
  assert.ok("error" in checkBatch([call(USDG.address, "0x00", { input: "0x01" })], KNOWN));
  assert.ok("error" in checkBatch([call(USDG.address, `0x${"0".repeat(MAX_CALL_DATA)}`)], KNOWN));
  assert.ok("error" in checkBatch([{ method: "eth_call", params: [{ to: STRANGER, input: "0xa9059cbb" }, "latest"] }]));
});

test("estimates: our contracts or a plain ETH transfer; value only on estimates", () => {
  assert.ok("units" in checkBatch([{ method: "eth_estimateGas", params: [{ to: USDG.address, data: "0x12345678" }] }], KNOWN));
  assert.ok("units" in checkBatch([{ method: "eth_estimateGas", params: [{ to: STRANGER, value: "0x5" }] }]));
  assert.ok("error" in checkBatch([{ method: "eth_estimateGas", params: [{ to: STRANGER, data: "0x095ea7b3" + "0".repeat(128) }] }]));
  assert.ok("error" in checkBatch([{ method: "eth_estimateGas", params: [{ to: STRANGER, data: "0xa22cb465" + "0".repeat(128) }] }]));
  assert.ok("error" in checkBatch([{ method: "eth_estimateGas", params: [{ to: STRANGER, data: "0xa9059cbb" + "0".repeat(128) }] }]));
  assert.ok("error" in checkBatch([{ method: "eth_estimateGas", params: [{ to: STRANGER, data: "0xdeadbeef" }] }]));
  assert.ok("error" in checkBatch([{ method: "eth_estimateGas", params: [{ to: STRANGER, data: "0x095ea7b3" + "0".repeat(130) }] }]));
  assert.ok("error" in checkBatch([{ method: "eth_estimateGas", params: [{ to: STRANGER, value: "5" }] }]));
});

test("batch size and block reads", () => {
  assert.ok("error" in checkBatch([]));
  assert.ok("error" in checkBatch(Array.from({ length: 21 }, () => call(USDG.address, "0x18160ddd")), KNOWN));
  assert.ok("error" in checkBatch([{ method: "eth_getBlockByNumber", params: ["latest", true] }]));
  assert.ok("units" in checkBatch([{ method: "eth_getBlockByNumber", params: ["latest", false] }]));
});

test("a refused budget never reaches the RPC", async () => {
  let reached = false;
  const out = await runRelay(call(USDG.address, "0x18160ddd"), {
    charge: async () => "slow down",
    one: async () => {
      reached = true;
      return { result: "0x" };
    },
    many: async () => [],
  });
  assert.equal(out.status, 429);
  assert.equal(reached, false);
});

test("a refused target costs budget and never reaches the RPC", async () => {
  let charged = 0;
  let reached = false;
  const out = await runRelay(call(STRANGER, "0xdeadbeef"), {
    charge: async (u) => {
      charged += u;
      return null;
    },
    one: async () => {
      reached = true;
      return { result: "0x" };
    },
    many: async () => [],
  });
  assert.equal(out.status, 400);
  assert.ok(charged > 0);
  assert.equal(reached, false);
});

test("a plain read of a foreign address passes the whole relay with the low gas cap (pricing pass does not leak its gas)", async () => {
  let gas = "";
  const out = await runRelay(call(STRANGER, "0x18160ddd"), { charge: async () => null, one: async (_m, p) => ((gas = (p[0] as { gas: string }).gas), { result: "0x" }), many: async () => [] });
  assert.equal(out.status, 200);
  assert.equal(Number(BigInt(gas)), MAX_FOREIGN_GAS);
});

test("a dead upstream is a 502", async () => {
  const out = await runRelay(call(USDG.address, "0x18160ddd"), { charge: async () => null, one: async () => ({ down: true }), many: async () => [] });
  assert.equal(out.status, 502);
});

test("USDG and the Chainlink ETH/USD feed are readable through the relay, with any call data", () => {
  const t = readTargets();
  for (const a of ["0x5fc5360d0400a0fd4f2af552add042d716f1d168", "0x78f3556b67e17df817d51ef5a990cdaf09e8d3a9"]) assert.ok(t.has(a), a);
  // latestRoundData(): not in the plain-read list, allowed only because the feed is a known target
  assert.ok("units" in checkBatch([call("0x78f3556b67e17df817d51ef5a990cdaf09e8d3a9", "0xfeaf968c")]));
  assert.ok("error" in checkBatch([call(STRANGER, "0xfeaf968c")]));
});
