import type { Abi } from "viem";
import artifacts from "@/lib/contracts/artifacts.json";

/* Every ABI the site calls. The index's functions are the ones identified on chain (src/config/index.ts). */

export const WATCH_ABI = artifacts.contracts.VellenGapWatch.abi as Abi;

export const VAULT_ABI = [
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalAssets", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "convertToAssets", stateMutability: "view", inputs: [{ name: "shares", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "asset", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "navOracle", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "indexRegistry", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "depositsPaused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
] as const satisfies Abi;

export const LIST_ABI = [{ type: "function", name: "getActiveTokens", stateMutability: "view", inputs: [], outputs: [{ type: "address[]" }] }] as const satisfies Abi;

export const NAV_ORACLE_ABI = [
  { type: "function", name: "observe", stateMutability: "view", inputs: [{ name: "t", type: "address" }], outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "bool" }] },
  { type: "function", name: "getFeedConfig", stateMutability: "view", inputs: [{ name: "t", type: "address" }], outputs: [{ type: "address" }, { type: "uint256" }, { type: "uint256" }] },
] as const satisfies Abi;

export const ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const satisfies Abi;

export const V2_FACTORY_ABI = [{ type: "function", name: "getPair", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "address" }] }] as const satisfies Abi;
export const V3_FACTORY_ABI = [{ type: "function", name: "getPool", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }, { type: "uint24" }], outputs: [{ type: "address" }] }] as const satisfies Abi;

export const V3_POOL_ABI = [
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "slot0", stateMutability: "view", inputs: [], outputs: [{ type: "uint160" }, { type: "int24" }, { type: "uint16" }, { type: "uint16" }, { type: "uint16" }, { type: "uint8" }, { type: "bool" }] },
  { type: "function", name: "observations", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint32" }, { type: "int56" }, { type: "uint160" }, { type: "bool" }] },
  { type: "function", name: "observe", stateMutability: "view", inputs: [{ type: "uint32[]" }], outputs: [{ type: "int56[]" }, { type: "uint160[]" }] },
] as const satisfies Abi;

export const FEED_ABI = [
  { type: "function", name: "latestRoundData", stateMutability: "view", inputs: [], outputs: [{ type: "uint80" }, { type: "int256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint80" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const satisfies Abi;
