import { watchLive } from "@/config/contracts";

/*
 * Status of every feature, shown next to it on the site. "Prototype" = runs now and can be checked; "Concept" = proposed,
 * not built. Launch material uses the same words. Numbers that do not come from a live source carry a "Sample data" badge.
 * Vellen as a whole is a pre-launch concept for Robinhood Chain; the basic comparison is free and needs no token.
 */
export type Status = "Prototype" | "Concept";

export const FEATURES: { key: string; name: string; status: Status; what: string; limit: string }[] = [
  {
    key: "gap",
    name: "Price vs NAV, live",
    status: "Prototype",
    what: "NAV per token of the live IPO index on Robinhood Chain, the age of the oldest price behind it, and a search of Uniswap v2, v3 and v4 for a market of the index token.",
    limit: "No pool trades the index token today, so its own premium or discount is not measurable; the page says so.",
  },
  {
    key: "basket",
    name: "Look-through gap",
    status: "Prototype",
    what: "The index's holdings priced at their own pools' 30-minute TWAP plus cash, per token, against NAV; per constituent: oracle price and age, pool price, last pool activity.",
    limit: "Measures the holdings, not the index token. Pools can be thin; depth is shown.",
  },
  {
    key: "history",
    name: "Executions and history",
    status: "Prototype",
    what: "Every mint and redeem of the index token at its executed price against NAV at the block before, and NAV and the basket sampled since the index started.",
    limit: "Historic reads need an archive endpoint; missing points are left out, never filled in.",
  },
  {
    key: "calculator",
    name: "Threshold calculator",
    status: "Prototype",
    what: "Enter a price (or use the basket) and a threshold: see the gap, whether a premium, discount or either-side rule would trigger, and the quiet band.",
    limit: "Shows what a rule would say now. It sends nothing.",
  },
  {
    key: "contract",
    name: "Rules on chain (VellenGapWatch)",
    status: watchLive() ? "Prototype" : "Concept",
    what: "Tracks, checkpoints the contract computes itself (NAV, TWAP price, both ages, the gap), threshold rules with cooldown, evaluate and fire.",
    limit: watchLive() ? "Live on Robinhood Chain. No funds, no owner." : "Built and tested, not deployed yet. The owner deploys it later.",
  },
  { key: "alerts", name: "Alerts", status: "Concept", what: "A message when a rule fires (premium or discount past your threshold).", limit: "Not built." },
  { key: "token", name: "$VELLEN credits", status: "Concept", what: "Planned test: $VELLEN as credits for those alerts.", limit: "Not built. Every feature above works without the token." },
];

export const contractStatus = () => ({ watch: watchLive() });
