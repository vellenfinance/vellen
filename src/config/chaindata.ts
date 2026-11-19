/*
 * Real Robinhood Chain contracts the site reads. Each was checked on chain on 19 Nov 2026 (see referensi/research/chain-facts.txt):
 * USDG: symbol() "USDG", decimals() 6, the address Chainlink's USDG/USD feed and the RH stock-token pools quote against.
 * ETH/USD: Chainlink standard proxy, description() "ETH / USD", 8 decimals (docs.chain.link, network robinhood).
 */
export type TokenInfo = { address: `0x${string}`; symbol: string; decimals: number; note: string };

export const TOKENS: TokenInfo[] = [{ address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", symbol: "USDG", decimals: 6, note: "Global Dollar stablecoin" }];

export const FEEDS = [{ address: "0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9" as `0x${string}`, pair: "ETH / USD", decimals: 8 }];
