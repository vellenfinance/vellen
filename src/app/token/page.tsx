import Link from "next/link";
import { CaBox } from "@/components/site/CaCopy";
import { PageHead, StatusBadge } from "@/components/site/PageHead";
import { BRAND, CHAIN, TOKEN } from "@/config/brand";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/token",
  title: `${BRAND.symbol} (${BRAND.tokenName}) | ${BRAND.name}`,
  description: `${BRAND.symbol} on ${BRAND.chainName}: contract address${TOKEN.isLive ? "" : " (published at launch)"}, what it is and is not. Every ${BRAND.name} feature works without it.`,
});

export default function TokenPage() {
  return (
    <>
      <PageHead eyebrow={`Token · ${BRAND.tokenName}`} title={`${BRAND.symbol}. Not needed to read a gap.`}>
        The comparison, the history and the calculator are free and work without it. {BRAND.symbol} is a memecoin with a planned utility: not a share of anything,
        not a claim on the index, not a promise of value.
      </PageHead>
      <div className="wrap grid grid-cols-1 gap-3 pt-12 lg:grid-cols-2" data-stagger>
        <section className="card p-6 md:p-8" data-testid="token-ca">
          <h2 className="d4">Contract address</h2>
          <p className="t15 muted mt-3">
            {TOKEN.isLive
              ? `The only ${BRAND.symbol} contract on ${CHAIN.name}. Check it here before you trade; copies with the same name exist.`
              : `Not launched yet. The address is published here and on X ${BRAND.xHandle} at launch; any address shared before that is not ours.`}
          </p>
          <CaBox testid="ca-token" className="mt-6 w-full" />
          <p className="t14 muted mt-4">
            Network: {CHAIN.name} (chain {CHAIN.id}), gas paid in {CHAIN.nativeSymbol}. {TOKEN.isLive ? "" : "Launchpad: TBA. "}We never send direct messages first.
          </p>
        </section>
        <section className="card p-6 md:p-8" id="status">
          <h2 className="d4 flex flex-wrap items-center gap-3">
            Planned utility <StatusBadge status="Concept" />
          </h2>
          <ul className="t15 muted mt-4 grid grid-cols-1 gap-3">
            <li>To be tested: {BRAND.symbol} as credits for alerts when a premium or discount passes a threshold you choose.</li>
            <li>The basic comparison stays free, with or without the token.</li>
          </ul>
          <p className="t14 muted mt-6">No yield, no revenue share, no price promise. Holding {BRAND.symbol} gives no claim on any fee, contract or index.</p>
          <Link href="/gap" className="pill pill-black mt-6">
            Use the Gap Watch without it
          </Link>
        </section>
      </div>
    </>
  );
}
