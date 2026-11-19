"use client";

import { useMemo, useState } from "react";
import { useLocalStore } from "@/components/wallet/useLocalStore";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { CHAIN, explorerAddress, explorerTx, isAddress } from "@/config/brand";
import { storageKey } from "@/config/storage";
import { explain, waitForReceipt } from "@/lib/client";

type Done = { address: string; tx: string; block: number };
const isTx = (v: unknown): v is string => typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);
const okDone = (d: Done | null | undefined): d is Done => !!d && isAddress(d.address) && isTx(d.tx) && Number.isSafeInteger(d.block) && d.block > 0;

export function DeployPanel({ watch }: { watch: { creation: string; sha256: string; args: string } }) {
  const { address, onChain, sendTransaction, switchNetwork } = useWallet();
  const { open } = useWalletModal();
  // Stored progress is browser data, so it is checked before it can reach a link or the pasted config.
  const [stored, setStored] = useLocalStore<Done | null>(storageKey("deploy", String(CHAIN.id)), null);
  const done = useMemo(() => (okDone(stored) ? stored : null), [stored]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const say = (s: string) => setLog((l) => [`${new Date().toLocaleTimeString()} ${s}`, ...l]);

  async function deploy() {
    setBusy(true);
    try {
      const data = watch.creation + watch.args;
      say(`VellenGapWatch: confirm in the wallet (${(data.length - 2) / 2} bytes)`);
      const hash = await sendTransaction({ data });
      say(`sent ${hash}`);
      const r = await waitForReceipt(hash, 300_000);
      if (!r.ok || !r.contractAddress) throw new Error("deployment reverted");
      say(`deployed at ${r.contractAddress} (block ${r.blockNumber})`);
      setStored({ address: r.contractAddress, tx: hash, block: r.blockNumber });
    } catch (e) {
      say(`failed: ${explain(e)}`);
    } finally {
      setBusy(false);
    }
  }

  if (!address)
    return (
      <button type="button" className="pill pill-black" onClick={open}>
        Connect the deployer wallet
      </button>
    );
  if (!onChain)
    return (
      <button type="button" className="pill pill-black" onClick={switchNetwork}>
        Switch to {CHAIN.name}
      </button>
    );
  return (
    <div className="card grid gap-6 p-6 md:p-8" data-testid="deploy-panel">
      <div>
        <h2 className="d4">VellenGapWatch</h2>
        <p className="t14 muted mt-2">Creation code sha256 {watch.sha256.slice(0, 16)}…, constructor argument: the Uniswap v3 factory on Robinhood Chain (0x1f7d…2efa). No owner.</p>
        <button type="button" className="pill pill-black mt-4" disabled={busy || !!done} onClick={deploy} data-testid="deploy-watch">
          {done ? "Deployed" : busy ? "Waiting…" : "Deploy VellenGapWatch"}
        </button>
        {done ? (
          <p className="t14 mt-3">
            Contract{" "}
            <a className="addr link" href={explorerAddress(done.address)} target="_blank" rel="noreferrer">
              {done.address}
            </a>{" "}
            · tx{" "}
            <a className="addr link" href={explorerTx(done.tx)} target="_blank" rel="noreferrer">
              {done.tx}
            </a>
          </p>
        ) : null}
      </div>
      {done ? (
        <div className="border-t border-black/10 pt-6">
          <p className="eyebrow">Paste into src/config/contracts.ts</p>
          <pre className="code mt-2" data-testid="deploy-snippet">{`const DEPLOYED = {\n  watch: "${done.address}",\n  block: ${done.block},\n};`}</pre>
          <p className="eyebrow mt-4">Then check it</p>
          <pre className="code mt-2">{`npm run verify-deployment -- --watch ${done.address} --watch-tx ${done.tx}`}</pre>
        </div>
      ) : null}
      <button type="button" className="pill pill-line justify-self-start" onClick={() => setStored(null)}>
        Forget this deployment on this device
      </button>
      {log.length ? (
        <div className="code">
          {log.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
