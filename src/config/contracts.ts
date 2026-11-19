import { isAddress } from "@/config/brand";

/*
 * Vellen's contract on Robinhood Chain (chain 4663): VellenGapWatch (+ internal library VellenGapMath).
 * NOT DEPLOYED YET: the owner deploys it from /deploy (localhost only), constructor argument = the Uniswap v3 factory
 * 0x1f7d7550b1b028f7571e69a784071f0205fd2efa. Then put the address and block below and run
 * `npm run verify-deployment -- --watch <address> --watch-tx <tx>`.
 *   Tracks (index token + how its market side is priced), checkpoints computed by the contract (NAV, TWAP price, both
 *   ages, gap), threshold rules with cooldown, evaluate/fire. No owner, no fee, no upgrade, accepts no ether.
 */
const DEPLOYED = {
  watch: "TBA",
  /** Block of the deployment transaction (0 until deployed). */
  block: 0,
};

/**
 * Local tests only: NEXT_PUBLIC_VELLEN_TEST_CONTRACTS='{"watch":"0x…","block":1}' at build time points a second build at a
 * contract on an anvil chain. Never set it on Vercel.
 */
function testOverride(): typeof DEPLOYED | null {
  const raw = process.env.NEXT_PUBLIC_VELLEN_TEST_CONTRACTS;
  if (!raw) return null;
  try {
    const v = { ...DEPLOYED, ...(JSON.parse(raw) as Partial<typeof DEPLOYED>) };
    return isAddress(v.watch) ? v : null;
  } catch {
    return null;
  }
}

export const CONTRACTS = testOverride() ?? DEPLOYED;
export const watchLive = () => isAddress(CONTRACTS.watch);
export const CONTRACT_NAME = "VellenGapWatch" as const;
/** Constructor argument. */
export const V3_FACTORY_ARG = "0x1f7d7550b1b028f7571e69a784071f0205fd2efa" as const;
