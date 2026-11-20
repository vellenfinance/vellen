import { BRAND } from "@/config/brand";

/* FAQ, two audiences as the reference's toggle. Also emitted as FAQPage JSON-LD on /method. */
export const FAQ_HOLDERS = [
  { q: `What does ${BRAND.name} show?`, a: "For an IPO index token on Robinhood Chain: its market price (if anything trades it), its NAV per token, the gap between them in percent, and the age and source of each number." },
  { q: "Why does it say “no market”?", a: "Because no pool trades the index token today: Vellen asks every Uniswap v2 and v3 pair for it and scans Uniswap v4 pool creations since the index was deployed, and shows each answer. Mint and redeem with the index itself, at NAV, are the only way in and out." },
  { q: "Then what is the look-through gap?", a: "The index's holdings valued at their own pools' 30-minute time-weighted prices (plus its cash), per token, compared with NAV, which values the same holdings at Chainlink prices. It tells you whether the holdings trade above or below their oracle value; it is not a price of the index token." },
  { q: "How old is the NAV?", a: "As old as the oldest constituent price behind it, shown next to it. Stock price feeds update during US market hours, so over a weekend NAV rests on Friday's prices." },
  { q: "Is a premium a reason to buy or sell?", a: "No. Vellen measures; it does not advise. Fees, spreads, pauses and timing all matter, and none of this is financial advice." },
  { q: `Do I need a wallet or ${BRAND.symbol}?`, a: `Neither. Everything on the Gap Watch is free and works without a wallet. A wallet only lets you record threshold rules in the contract. ${BRAND.symbol} is not needed for anything.` },
];

export const FAQ_BUILDERS = [
  { q: "Where do the numbers come from?", a: "Straight from Robinhood Chain: the index token (ERC-4626 convertToAssets, totalAssets, totalSupply), its constituent list, its price oracle (which reads Chainlink feeds), Uniswap v3 pools (observe for the TWAP, slot0 for spot) and PoolManager logs for v4." },
  { q: "How were the index's functions identified?", a: "Its source is not published on Sourcify, so the functions come from the bytecode's selector table, resolved against public signature databases, and each one used was called and cross-checked on chain (for example, totalAssets equals the holdings times the oracle prices plus cash)." },
  { q: "What does the contract do?", a: "VellenGapWatch stores tracks (an index token and how its market side is priced), checkpoints it computes itself (NAV, time-weighted price, both ages, the gap) and threshold rules with a cooldown; evaluate() says whether the latest checkpoint crosses a rule. It holds no funds, has no owner and accepts no ether." },
  { q: "Is the contract deployed?", a: "Yes. VellenGapWatch is live on Robinhood Chain and its source is verified on the explorer; the Method page links the address. It is built and tested (unit, hostile-input, invariant and fork tests against the live index)." },
  { q: "Why a 30-minute TWAP?", a: "A spot price can be pushed inside one block; a time-weighted average over 30 minutes cannot be moved cheaply. The site and the contract use the same window." },
  { q: "What are the risks?", a: "Vellen is a concept with a new prototype and a newly deployed contract. Data can be stale or unavailable, and an index can change its constituents. Treat every figure as a reading with a date, not a guarantee." },
];

export const FAQ = [...FAQ_HOLDERS, ...FAQ_BUILDERS];
