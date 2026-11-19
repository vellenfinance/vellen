// verify-lib against a fake chain built from this build's artifacts: a true deployment matches; a foreign runtime, another
// factory, a wrong chain, extra constructor bytes, a missing tx or a tx for another address each fail.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FACTORY, match, verifyDeployment } from "./verify-lib.mjs";

const ART = JSON.parse(readFileSync(new URL("../src/lib/contracts/artifacts.json", import.meta.url), "utf8")).contracts;
const A = (n) => "0x" + n.toString(16).padStart(40, "0");
const W = A(0xb00c);
const TX1 = "0x" + "01".repeat(32);
const R = ART.VellenGapWatch;
const word = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");

function deployed(factory = FACTORY) {
  let code = R.runtime.slice(2);
  for (const im of R.immutables) code = code.slice(0, im.start * 2) + word(factory) + code.slice(im.start * 2 + 64);
  return "0x" + code;
}

function chain(over = {}) {
  const codes = { [W]: deployed(), ...over.codes };
  const txs = { [TX1]: { input: over.input ?? R.creation + word(FACTORY), to: over.to ?? null, created: over.created ?? W, status: over.status ?? "0x1" } };
  return async (method, params) => {
    if (method === "eth_chainId") return over.chainId ?? "0x1237";
    if (method === "eth_getCode") return codes[params[0].toLowerCase()] ?? "0x";
    if (method === "eth_getTransactionByHash") return txs[params[0]] ? { input: txs[params[0]].input, to: txs[params[0]].to } : null;
    if (method === "eth_getTransactionReceipt") return txs[params[0]] ? { status: txs[params[0]].status, contractAddress: txs[params[0]].created } : null;
    throw new Error(`unexpected ${method}`);
  };
}
const run = (over = {}, args = {}) => verifyDeployment({ watch: W, watchTx: TX1, rpc: chain(over), ART, ...args });

test("the watch has exactly the factory immutable and matches with the real factory only", () => {
  assert.ok(R.immutables.length >= 1);
  assert.ok(R.immutables.every((i) => i.name === "factory"));
  assert.ok(match(ART, "VellenGapWatch", deployed()));
  assert.equal(match(ART, "VellenGapWatch", deployed(A(7))), false);
});

test("a true deployment matches", async () => {
  const r = await run();
  assert.equal(r.ok, true, r.lines.join("\n"));
});

test("every way to be wrong fails", async () => {
  assert.equal((await run({ chainId: "0x1" })).ok, false);
  assert.equal((await run({ codes: { [W]: "0x6000" } })).ok, false);
  assert.equal((await run({ codes: { [W]: deployed(A(9)) } })).ok, false);
  assert.equal((await run({ input: R.creation + word(FACTORY) + "00" })).ok, false);
  assert.equal((await run({ input: R.creation + word(A(9)) })).ok, false);
  assert.equal((await run({ created: A(1) })).ok, false);
  assert.equal((await run({ status: "0x0" })).ok, false);
  assert.equal((await run({ to: A(5) })).ok, false);
  assert.equal((await run({}, { watchTx: undefined })).ok, false);
  assert.equal((await run({}, { watch: "nope" })).ok, false);
  assert.equal((await verifyDeployment({ watch: W, watchTx: TX1, rpc: async () => { throw new Error("down"); }, ART })).ok, false);
});
