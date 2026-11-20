import { isAddress } from "@/config/brand";

/*
 * Vellen's contract on Robinhood Chain (chain 4663): VellenGapWatch (+ internal library VellenGapMath, inlined, nothing to link),
 * live and source-verified on Blockscout since 2026-11-20. Constructor argument = the Uniswap v3 factory
 * 0x1f7d7550b1b028f7571e69a784071f0205fd2efa. Check it: `npm run verify-deployment -- --watch <address> --watch-tx <tx>`.
 *   Tracks (index token + how its market side is priced), checkpoints computed by the contract (NAV, TWAP price, both
 *   ages, gap), threshold rules with cooldown, evaluate/fire. No owner, no fee, no upgrade, accepts no ether.
 */
const DEPLOYED = {
  watch: "0x45fd0dca84e7c3cde143f576152b0188e781a3ac",
  /** Block of the deployment transaction. */
  block: 119061090,
  /** Creation transaction. */
  tx: "0xdca0393d492170c4f76af5a1e85dc54e4e043ec573a096f9c07e51e4dff0a87b",
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
