/*
 * The live IPO index on Robinhood Chain (chain 4663) that Vellen reads. Vellen is not part of it and never names it: the site
 * calls it "the live IPO index on Robinhood Chain" and links its contracts. Every address and function below was identified
 * on 19 Nov 2026 (referensi/research/chain-facts.txt):
 *   - no verified source on Sourcify; the explorer API refuses plain server requests from this machine;
 *   - so functions come from the runtime bytecode's selector table, resolved against public signature databases, and every
 *     one used here was called and its answer cross-checked (e.g. totalAssets = sum of holdings x oracle price + cash,
 *     observe(token) = the Chainlink feed's latest answer and updatedAt, to the wei).
 * Functions that could not be identified this way are not used.
 */
export const INDEX = {
  /** ERC-4626 vault = the index token. asset() USDG, decimals() 18. */
  vault: "0x4B129357B164d65834bdBA935c3cD08FcB7e14DA",
  /** Constituent list: getActiveTokens() (0x5f5817e3). */
  registry: "0xBD5a9d71dec44bc7282d341eBFD9b4043e16dd77",
  /** Per-token prices: observe(address) (0xe8f1d23f) -> (price 1e18, updatedAt, ok); getFeedConfig(address) (0xd7b1443d) -> (feed, heartbeat, decimals). */
  navOracle: "0xBC888398B61c12D87F498f27f6B0e02EA028904C",
  /** Deployment block of the vault (first log: OwnershipTransferred at 117,303,684). */
  deployBlock: 117_303_684,
  asset: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
  assetSymbol: "USDG",
  assetDecimals: 6,
  decimals: 18,
} as const;

/** Swap venues checked for a market price of the index token (addresses read on chain in earlier Robinhood Chain projects). */
export const VENUES = {
  v2Factory: "0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f",
  v3Factory: "0x1f7d7550b1b028f7571e69a784071f0205fd2efa",
  v4PoolManager: "0x8366a39cc670b4001a1121b8f6a443a643e40951",
  weth: "0x0bd7d308f8e1639fab988df18a8011f41eacad73",
  v3Fees: [100, 500, 3000, 10000] as const,
} as const;

/** keccak256("Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)") of the v4 PoolManager. */
export const V4_INITIALIZE_TOPIC = "0xdd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438";
/** ERC-4626 Deposit(address,address,uint256,uint256) and Withdraw(address,address,address,uint256,uint256). */
export const DEPOSIT_TOPIC = "0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7";
export const WITHDRAW_TOPIC = "0xfbde797d201c681b91056529119e0b02407c7bb96a4a2c75c01fc9667232c8db";

/** Market-side prices are time-weighted over this window (the contract uses the same default). */
export const TWAP_WINDOW = 1800;

/**
 * Official stock token proof (memory: ticker is not identity): proxy runtime codehash, ERC-1967 beacon slot = the official
 * beacon, and totalSupply() > 0. Only then is a ticker shown.
 */
export const STOCK_TOKEN = {
  proxyCodehash: "0x6c1fdd40002dcb440c7fff6a84171404d279ccb057803b65826f7546acd65630",
  beacon: "0xe10b6f6b275de231345c20d14ab812db62151b00",
  beaconSlot: "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50",
} as const;
