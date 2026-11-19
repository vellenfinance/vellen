import Link from "next/link";
import { BRAND, hasGithub } from "@/config/brand";
import { INDEX } from "@/config/index";
import { Wordmark } from "@/components/site/Mark";
import { CaBox } from "@/components/site/CaCopy";
import { XIcon } from "@/components/site/Icons";
import { explorerAddress } from "@/config/brand";

/* Footer as the reference: a black rounded card with the wordmark, social buttons, two link columns and the small print. */
export function SiteFooter() {
  return (
    <footer className="px-4 pt-24 pb-4 md:px-4">
      <div className="footcard dark px-6 pt-12 pb-8 md:px-14 md:pt-16">
        <div className="grid gap-10 md:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <Wordmark size={30} />
            <div className="mt-6 flex gap-2">
              <a href={BRAND.x} target="_blank" rel="noreferrer" aria-label={`${BRAND.name} on X`} className="vl-roundbtn border-white/30">
                <XIcon size={14} />
              </a>
              {hasGithub ? (
                <a href={BRAND.github} target="_blank" rel="noreferrer" className="vl-roundbtn border-white/30" aria-label="Source code">
                  <span className="t12">GH</span>
                </a>
              ) : null}
            </div>
            <div className="mt-6 max-w-[420px]">
              <CaBox testid="footer-ca" />
            </div>
          </div>
          <nav className="grid content-start gap-2 t14" aria-label="Product">
            <Link href="/gap">Gap Watch</Link>
            <Link href="/gap#history">Executions and history</Link>
            <Link href="/gap#calculator">Threshold calculator</Link>
            <Link href="/rules">Rules on chain</Link>
            <Link href="/method">Method</Link>
            <Link href="/token">{BRAND.symbol}</Link>
          </nav>
          <nav className="grid content-start gap-2 t14 muted" aria-label="Sources">
            <a href={explorerAddress(INDEX.vault)} target="_blank" rel="noreferrer">
              The index token on the explorer
            </a>
            <a href={explorerAddress(INDEX.navOracle)} target="_blank" rel="noreferrer">
              Its price oracle
            </a>
            <a href={BRAND.x} target="_blank" rel="noreferrer">
              {BRAND.xHandle} on X
            </a>
            <Link href="/llms.txt">llms.txt</Link>
          </nav>
        </div>
        <p className="t12 muted mt-14 max-w-[880px]">
          {BRAND.name} is a concept with a working prototype, planned for {BRAND.chainName}. It reads public chain data and is not affiliated with Robinhood, with
          the index it reads, or with any issuer. Stock tokens shown are tokens on {BRAND.chainName}, not the shares themselves. A premium or a discount is a
          measurement, not a signal to buy or sell; nothing here is financial advice. {BRAND.symbol} is not needed to use the site.
        </p>
        <p className="t12 faint mt-6">
          © {new Date().getFullYear()} {BRAND.name} · {BRAND.domain}
        </p>
      </div>
    </footer>
  );
}
