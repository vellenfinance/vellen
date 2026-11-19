import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BRAND, CHAIN } from "@/config/brand";
import { DeployPanel } from "@/components/deploy/DeployPanel";
import { PageHead } from "@/components/site/PageHead";
import { V3_FACTORY_ARG } from "@/config/contracts";
import ART from "@/lib/contracts/artifacts.json";

export const metadata: Metadata = {
  title: "Deploy the Vellen gap watch",
  description: `Owner tool: deploy ${BRAND.name}'s VellenGapWatch from your own wallet.`,
  robots: { index: false, follow: false },
};

// Owner tool, local only: on any public host this route is a 404.
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export const dynamic = "force-dynamic";

export default async function DeployPage() {
  const host = (await headers()).get("host") ?? "";
  if (!LOCAL_HOST.test(host)) notFound();
  const r = ART.contracts.VellenGapWatch;
  const args = V3_FACTORY_ARG.slice(2).toLowerCase().padStart(64, "0");
  return (
    <>
      <PageHead eyebrow="Owner tool · localhost only" title="Deploy VellenGapWatch.">
        <p>
          One transaction signed in your wallet on {CHAIN.name} (gas in {CHAIN.nativeSymbol}, about 3.9 M gas): one constructor argument (the Uniswap v3 factory), no owner, no fee. The contract accepts no ether and never holds or moves funds.
        </p>
      </PageHead>
      <section className="wrap py-14">
        <DeployPanel watch={{ creation: r.creation, sha256: r.sha256, args }} />
      </section>
    </>
  );
}
