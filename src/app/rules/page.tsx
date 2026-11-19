import type { Metadata } from "next";
import { RulesView } from "@/components/app/RulesView";
import { PageHead } from "@/components/site/PageHead";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  path: "/rules",
  title: "Rules: premium and discount thresholds on chain",
  description: "VellenGapWatch on Robinhood Chain: tracks for an index token, checkpoints the contract computes itself (NAV, time-weighted price, both ages, the gap) and threshold rules with a cooldown.",
});

export default function RulesPage() {
  return (
    <>
      <PageHead eyebrow="Rules · VellenGapWatch" title="A threshold rule the chain can check by itself.">
        Register “tell me when the gap passes x %”. Anyone can record a checkpoint; the contract reads NAV and the time-weighted pool prices itself, stores both ages,
        and says whether your rule is crossed. Alerts on top of it are planned.
      </PageHead>
      <RulesView />
    </>
  );
}
