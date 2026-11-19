// Checks behind scripts/verify-deployment.mjs, free of I/O so they can be tested with a fake chain.
//
// How it decides that an address runs this repository's VellenGapWatch:
//   - Runtime code is compared byte for byte with src/lib/contracts/artifacts.json (`npm run contracts:artifacts -- --check`
//     proves that file is a fresh forge build), except the bytes of the one immutable (`factory`), which must hold exactly
//     the Uniswap v3 factory on Robinhood Chain.
//   - The creation transaction is required (no tx => FAIL, never MATCH). It must have succeeded, created exactly the address
//     checked, have no recipient, and carry exactly this build's creation code followed by the ABI-encoded factory address.
// Every check fails closed: an RPC error, an empty or malformed answer is a FAIL, never a skip.

export const CHAIN_ID = 4663;
export const NAME = "VellenGapWatch";
export const FACTORY = "0x1f7d7550b1b028f7571e69a784071f0205fd2efa";

const isAddr = (v) => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);
const isHex = (v) => typeof v === "string" && /^0x([0-9a-fA-F]{2})*$/.test(v);
const isTx = (v) => typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const word = (addr) => addr.toLowerCase().replace(/^0x/, "").padStart(64, "0");

/** True when `code` is this build's runtime with every immutable slot holding the expected factory word. */
export function match(ART, name, code, factory = FACTORY) {
  const a = ART[name];
  if (!a) return false;
  const want = a.runtime.slice(2);
  const got = String(code).toLowerCase().replace(/^0x/, "");
  if (got.length !== want.length) return false;
  let rebuilt = got;
  for (const im of a.immutables) {
    if (im.name !== "factory" || im.length !== 32) return false;
    const at = im.start * 2;
    if (got.slice(at, at + 64) !== word(factory)) return false;
    rebuilt = rebuilt.slice(0, at) + "0".repeat(64) + rebuilt.slice(at + 64);
  }
  return rebuilt === want;
}

/** input: { watch, watchTx, rpc, ART }. Returns { ok, lines }. */
export async function verifyDeployment({ watch, watchTx, rpc, ART }) {
  const lines = [];
  let failed = false;
  const ok = (m) => lines.push(`OK   ${m}`);
  const fail = (m) => {
    failed = true;
    lines.push(`FAIL ${m}`);
  };
  const done = () => ({ ok: !failed, lines });

  try {
    const id = await rpc("eth_chainId", []);
    if (Number(BigInt(id)) !== CHAIN_ID) {
      fail(`chain id ${id}, expected ${CHAIN_ID}`);
      return done();
    }
    ok(`chain id ${CHAIN_ID} (Robinhood Chain)`);
  } catch (e) {
    fail(`chain id unreadable: ${e.message}`);
    return done();
  }
  if (!isAddr(watch)) {
    fail("give --watch <address>");
    return done();
  }
  try {
    const c = await rpc("eth_getCode", [watch, "latest"]);
    if (!isHex(c) || c.length <= 2) throw new Error(`no code at ${watch}`);
    if (match(ART, NAME, c)) ok(`${NAME} at ${watch}: runtime matches this build, factory = ${FACTORY}`);
    else fail(`${NAME} at ${watch}: runtime differs from this build (or another factory)`);
  } catch (e) {
    fail(`${NAME}: ${e.message}`);
  }
  if (!isTx(watchTx)) {
    fail(`${NAME}: no valid creation tx given; runtime alone is not a full match`);
    return done();
  }
  try {
    const [t, rc] = await Promise.all([rpc("eth_getTransactionByHash", [watchTx]), rpc("eth_getTransactionReceipt", [watchTx])]);
    if (!t || !rc) fail(`${NAME}: creation tx ${watchTx} not found`);
    else if (rc.status !== "0x1") fail(`${NAME}: creation tx failed`);
    else if (!same(rc.contractAddress, watch)) fail(`${NAME}: tx created ${rc.contractAddress}, not ${watch}`);
    else if (t.to) fail(`${NAME}: tx has a recipient, not a deployment`);
    else if (String(t.input).toLowerCase() === ART[NAME].creation.toLowerCase() + word(FACTORY)) ok(`${NAME}: creation input is this build's creation code + the factory argument`);
    else fail(`${NAME}: creation input differs from this build`);
  } catch (e) {
    fail(`${NAME}: creation tx unreadable: ${e.message}`);
  }
  return done();
}
