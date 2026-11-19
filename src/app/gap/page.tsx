import type { Metadata } from "next";
import Link from "next/link";
import { GapWatch } from "@/components/app/GapWatch";
import { PageHead } from "@/components/site/PageHead";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  path: "/gap",
  title: "Gap Watch: IPO index price vs NAV, live",
  description:
    "NAV per token of the live IPO index on Robinhood Chain, the age of every price behind it, where a market for the token was looked for, the holdings priced at their own pools, a threshold calculator and every mint and redeem against NAV.",
});

export default function GapPage() {
  return (
    <>
      <PageHead
        eyebrow="Gap Watch · Prototype · live from Robinhood Chain"
        title="Price vs NAV, with the age of every number."
        actions={
          <>
            <Link href="#calculator" className="pill pill-cream">
              Threshold calculator
            </Link>
            <Link href="/method" className="pill pill-line">
              How it is computed
            </Link>
          </>
        }
      >
        Free, no wallet, no token. Every figure below is read from the chain at the block shown, with a link to check it. Nothing here is advice: a premium is not a
        reason to buy or sell.
      </PageHead>
      <GapWatch />
    </>
  );
}
