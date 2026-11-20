# Vellen

Vellen answers one practical question for people who hold or watch an IPO index token on Robinhood Chain: how many percent is the token's market price above or below the value of what it holds per token (its NAV), and how old is each of those numbers? It reads the index, its constituent prices and the pools around it straight from the chain, shows the gap with the age and source of every figure, and lets you test a premium or discount threshold.

IPO index price vs. NAV. Spot the premium. Track the discount. Planned for Robinhood Chain.

## Read this before anything else

This repository is the working code behind https://vellen.finance.

- **What runs today.** The Gap Watch reads the live IPO index on Robinhood Chain: NAV per token, the age of the oldest constituent price, a search of Uniswap v2, v3 and v4 for a market of the index token, the holdings priced at their own pools (a 30-minute time-weighted "look-through" gap), every mint and redeem against NAV at the block before, and a threshold calculator. Free, no wallet.
- **What the chain says right now.** No pool trades the index token, so its own premium or discount is not measurable. The site says "No market" and shows where it looked, instead of borrowing a price from somewhere else.
- **The contract.** `VellenGapWatch` records tracks, checkpoints it computes itself (NAV, time-weighted price, both ages, the gap) and threshold rules with a cooldown. It is live on Robinhood Chain at `0x45fd0dca84e7c3cde143f576152b0188e781a3ac`, source verified on Blockscout.
- **Planned, not built.** Alerts when a rule fires, and testing $VELLEN as credits for those alerts.
- **What nothing here claims.** No safety guarantee, no trading signal, no advice, no promised value for $VELLEN. Vellen is not affiliated with the index it reads, with Robinhood or with any issuer. Stock tokens are tokens on Robinhood Chain, not the shares themselves.

## Layout

| Path | What it is |
|---|---|
| `src/app/` | Pages (`/`, `/gap`, `/rules`, `/method`, `/token`) and API routes (`/api/gap`, `/api/gap/history`, `/api/chain`, `/api/rpc`). |
| `src/components/` | Interface components: home sections, the Gap Watch, the rules view, wallet dialog, header and footer. |
| `src/config/` | `brand.ts` (name, ticker, token address, links), `index.ts` (the index contracts read and how their functions were identified), `contracts.ts` (deployed contract address). |
| `src/lib/` | `gap/math.ts` (the formula, one-to-one with the contract), `server/gap.ts` (live reading), `server/gaphistory.ts` (proven history), the RPC relay rules and rate limits. |
| `contracts/` | Solidity sources (`src/`) and Foundry tests (`test/`): unit, hostile input, invariant, parity and fork tests. |
| `scripts/` | `verify-deployment`, the contract artifact builder and the parity vector generator. |
| `public/` | Wallet logos and the placeholder mark. |

## Run the tests

Node.js 20 or newer.

```
npm install
npm run typecheck
npm test
```

Contracts use [Foundry](https://book.getfoundry.sh/):

```
cd contracts
bash setup.sh
forge test
```

Fork tests against Robinhood Chain (an RPC that serves recent state):

```
forge test --match-contract Fork --fork-url https://rpc.mainnet.chain.robinhood.com --evm-version cancun
```

### What was checked for this snapshot

20 Nov 2026 (UTC), Node.js 25, forge 1.5.1: typecheck exit 0; `npm test` 27 pass / 0 fail; production build 18 routes; `forge test` 36 passed (29 unit and hostile-input tests incl. 2 fuzz at 1,024 runs, 4 parity tests over 458 vectors from the site's math, 3 invariants) and 5 fork tests against the live index passed separately (NAV equals `convertToAssets`, no direct pool, look-through gap +0.375 %, tick math brackets live pool prices). Browser tests with an injected wallet on an anvil fork are listed in the internal notes; they need a local chain and are not part of `npm test`. Mainnet deployment (block 119,061,090): `verify-deployment` printed MATCH (runtime byte for byte, factory argument, creation input).

## Look at the site

```
npm install
npm run build
npm start
```

Open http://localhost:6590. Everything works with no configuration: the server reads the public Robinhood Chain RPC, and history reads at past blocks use a public archive endpoint. Optional: `ROBINHOOD_RPC_URL` (https URL of a private RPC), `ARCHIVE_RPC_URL` (https URL of an archive-capable RPC) and `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (32 hex characters; without it WalletConnect shows "Not configured on this site yet").

## Contracts

| Contract | Address | Explorer |
|---|---|---|
| VellenGapWatch | `0x45fd0dca84e7c3cde143f576152b0188e781a3ac` | [Blockscout](https://robinhoodchain.blockscout.com/address/0x45fd0dca84e7c3cde143f576152b0188e781a3ac?tab=contract) |

`VellenGapWatch` takes one constructor argument, the Uniswap v3 factory on Robinhood Chain (`0x1f7d7550b1b028f7571e69a784071f0205fd2efa`); every pool a track uses must come from it. A track names an ERC-4626 index token and its market side: none, a pool of the token against its asset, or the basket of holdings priced at constituent pools. `recordCheckpoint` computes NAV, the time-weighted price (window of 60 seconds to 1 day), both ages and the gap, and stores them (one per second per track). Rules hold a direction, a threshold in basis points and a cooldown; `evaluate` returns Triggered, Clear, Cooldown, or why it cannot judge (no market, NAV stale or invalid, price stale, holdings not covered); `fire` records a crossing once per checkpoint and cooldown. No owner, no admin, no fee, no upgrade, and it accepts no ether and holds no funds.

## Verify a deployment

```
npm run verify-deployment -- --watch 0x45fd0dca84e7c3cde143f576152b0188e781a3ac --watch-tx 0xdca0393d492170c4f76af5a1e85dc54e4e043ec573a096f9c07e51e4dff0a87b
```

The script compares the bytecode on Robinhood Chain with the build in this repository (the factory immutable must hold the factory above) and the creation transaction with the creation code plus the constructor argument, and prints MATCH or the first difference.

## Add the network to your wallet

| Field | Value |
|---|---|
| Network | Robinhood Chain |
| Chain ID | 4663 |
| Currency | ETH |
| RPC | https://rpc.mainnet.chain.robinhood.com |
| Explorer | https://robinhoodchain.blockscout.com |

The site offers to add it when you connect.

## Data sources and limits

- **The index**: its token (`totalSupply`, `totalAssets`, `convertToAssets`), constituent list (`getActiveTokens`) and price oracle (`observe`, `getFeedConfig`, which reads Chainlink feeds). Its source is not published, so these functions were identified from the bytecode selector table and cross-checked on chain; nothing else is called.
- **Pools**: Uniswap v2/v3 factories for the market search, v3 pools for prices (`observe` for the 30-minute TWAP, `slot0` for spot), v4 PoolManager `Initialize` logs since the index was deployed.
- **History**: ERC-4626 `Deposit`/`Withdraw` events (one topic per query, the official RPC's limit) and reads at past blocks through an archive endpoint.
- **Caching**: the live reading is fresh for 30 seconds and the last good one is served for at most 10 minutes with its age shown; failures are never cached. History is kept 10 minutes.
- **Limits**: stock price feeds pause outside US market hours; pools can be thin (depth is shown); a time-weighted price lags fast moves by design; anything that cannot be read is shown as "—" or left out, never filled in.

## Token

$VELLEN (Vellen Finance) is the community token of Vellen on Robinhood Chain. Contract address: announced on https://vellen.finance at launch. It has no promised value. Planned: testing it as credits for premium and discount alerts; every feature above works without it.

## Deploy your own

1. Import the repository into a Next.js host (framework preset Next.js, root `./`), build `npm run build`.
2. Optional environment variables:

| Variable | What it is for | Format |
|---|---|---|
| `ROBINHOOD_RPC_URL` | Private Robinhood Chain RPC for server reads | `https://…` |
| `NEXT_PUBLIC_ROBINHOOD_RPC_URL` | Same, also used by the browser | `https://…` |
| `ARCHIVE_RPC_URL` | Archive-capable RPC for history at past blocks | `https://…` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect in the wallet dialog | 32 hex characters |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Shared rate-limit store | `https://…`, token string |
| `STORE_KEY_PREFIX` | Key prefix in that store | short text, default `vellen:` |

3. Point your domain at the host. After the deploy: `/` answers 200, `/api/gap` returns JSON with `"ok":true` and a block number, `/api/gap/history` answers 200.
4. Contract: the site points at the deployed `VellenGapWatch` above. To use your own, deploy it with the factory address as its only argument (for example `forge create`), put the address and block into `src/config/contracts.ts`, then run `npm run verify-deployment`.

## Contributing

Fork the repository, branch from `main`, and run `npm run typecheck`, `npm test` and `npm run build`, and `bash setup.sh && forge test` in `contracts/` before opening a pull request. For a bug, open an issue with the expected and actual behavior and minimal steps. Keep private keys, seed phrases and environment values out of issues.

## Security

Please do not open a public issue for a suspected vulnerability. Use GitHub private vulnerability reporting: open the **Security** tab of this repository and choose **Report a vulnerability**. The contract, the API routes, the RPC relay and transaction building are in scope; wallets, RPC providers, explorers, the index that is read and launchpads are not. There is no bug bounty.

## Notices and license

This project's original code is released under the [MIT License](LICENSE). Self-hosted fonts: Hanken Grotesk and IBM Plex Mono, both under the SIL Open Font License (license files in `src/fonts/`). Wallet logos in `public/wallets/` belong to their projects and are used only to identify each wallet. The Vellen name, logo and artwork belong to the project and are not licensed for reuse as a brand.
