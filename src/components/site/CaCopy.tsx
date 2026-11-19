"use client";

import Link from "next/link";
import { useState } from "react";
import { BRAND, TOKEN, buyUrl, shortAddress } from "@/config/brand";
import { CheckIcon, CopyIcon, ExternalIcon } from "@/components/site/Icons";

/* Copy CA: one component family, one source (BRAND.ca). Before launch it says the address is not published and copies nothing. */

export function useCopy(value: string) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard refused; the text stays visible.
    }
  };
  return { copied, copy };
}

/** The CA row: label, address, Copy, link out. */
export function CaBox({ testid = "ca-box", className = "", compact = false }: { testid?: string; className?: string; compact?: boolean }) {
  const { copied, copy } = useCopy(BRAND.ca);
  const live = TOKEN.isLive;
  // Compact (header): a short form whose Copy button copies the whole address. Full: the whole address, wrapping on narrow screens.
  const text = live ? (compact ? shortAddress(BRAND.ca, 6, 4) : BRAND.ca) : compact ? `${BRAND.symbol} · TBA` : `${BRAND.symbol} · TBA, published at launch`;
  return (
    <div className={`ca ${compact ? "" : "full"} ${className}`} data-testid={testid}>
      <span className="k">CA</span>
      <span className="v" title={live ? BRAND.ca : "Published at launch"} data-testid={`${testid}-value`}>
        {text}
      </span>
      <button type="button" className="copy" onClick={copy} disabled={!live} aria-label={live ? "Copy the contract address" : "No contract address yet"} data-testid={`${testid}-copy`}>
        {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />} {live ? (copied ? "Copied" : "Copy") : "TBA"}
      </button>
      {live ? (
        <a className="ext" href={buyUrl()} target="_blank" rel="noreferrer" aria-label="Open the token on the launchpad">
          <ExternalIcon size={13} />
        </a>
      ) : (
        <Link className="ext" href="/token" aria-label="About the token">
          <ExternalIcon size={13} />
        </Link>
      )}
    </div>
  );
}

/** Any address or hash as a small copy button. */
export function CopyChip({ value, label, head = 6, tail = 4 }: { value: string; label?: string; head?: number; tail?: number }) {
  const { copied, copy } = useCopy(value);
  return (
    <button type="button" className="bl-chip" onClick={copy} title={`Copy ${value}`}>
      {label ?? shortAddress(value, head, tail)} {copied ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
    </button>
  );
}
