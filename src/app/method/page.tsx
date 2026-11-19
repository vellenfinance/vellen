import { JsonLd } from "@/components/JsonLd";
import { PageHead, StatusBadge } from "@/components/site/PageHead";
import { CHAIN, explorerAddress } from "@/config/brand";
import { CONTRACTS, CONTRACT_NAME, V3_FACTORY_ARG, watchLive } from "@/config/contracts";
import { INDEX, TWAP_WINDOW, VENUES } from "@/config/index";
import { FEATURES } from "@/config/status";
import { FAQ } from "@/lib/faq";
import { faqLd, pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/method",
  title: "Method: how Vellen computes price vs NAV",
  description:
    "The gap formula, where NAV and every price come from, how a market for the index token is searched, the 30-minute time-weighted pool price, how history is proven, the contract and the limits.",
});

const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className="grid gap-2 border-b border-black/10 py-6 md:grid-cols-[280px_1fr] md:gap-10">
    <dt className="t18">{k}</dt>
    <dd className="t15 muted">{children}</dd>
  </div>
);
const A = ({ a }: { a: string }) => (
  <a className="link addr text-black" href={explorerAddress(a)} target="_blank" rel="noreferrer">
    {a}
  </a>
);

export default function MethodPage() {
  return (
    <>
      <JsonLd data={faqLd(FAQ)} />
      <PageHead eyebrow="Method" title="One formula, its sources, its limits.">
        gap = (price − NAV) ÷ NAV, in parts per million, truncated toward zero; the threshold counts as crossed when reached exactly. The site (src/lib/gap/math.ts)
        and {CONTRACT_NAME} (VellenGapMath) run the same lines, checked on 458 generated cases.
      </PageHead>
      <div className="wrap narrow pt-10">
        <dl>
          <Row k="The index read">
            The live IPO index on {CHAIN.name} (chain {CHAIN.id}). Index token (ERC-4626, asset {INDEX.assetSymbol}): <A a={INDEX.vault} />. Constituent list
            (getActiveTokens): <A a={INDEX.registry} />. Price oracle (observe, getFeedConfig): <A a={INDEX.navOracle} />. Vellen is not part of it and names it
            only by its contracts.
          </Row>
          <Row k="How its functions were identified">
            The index&apos;s source is not published on Sourcify and the explorer&apos;s API refuses plain server requests, so the functions come from the
            bytecode&apos;s selector table, resolved against public signature databases. Each one used was called and cross-checked: totalAssets equals the
            holdings × oracle prices + cash; observe(token) equals the Chainlink feed&apos;s latest answer and updatedAt. Functions that could not be identified are
            not used.
          </Row>
          <Row k="NAV per token">
            convertToAssets(1 token) on the index, in {INDEX.assetSymbol}. Recomputed as a cross-check from Σ(holding × oracle price) + cash ÷ supply; the page
            shows whether both agree with totalAssets within 0.1 %. Its age is the oldest constituent price (Chainlink updatedAt). Stock feeds update during US
            market hours; over a weekend NAV is Friday&apos;s.
          </Row>
          <Row k="Market price of the index token">
            Searched at every reading: Uniswap v2 getPair and v3 getPool (fees {VENUES.v3Fees.map((f) => f / 10_000 + "%").join(", ")}) against {INDEX.assetSymbol}{" "}
            and WETH, and Uniswap v4 PoolManager Initialize logs naming the token since block {INDEX.deployBlock.toLocaleString("en-US")}. On 20 Nov 2026 every
            answer was “none”, so the token&apos;s own premium or discount is not measurable, and the page says so instead of borrowing a price.
          </Row>
          <Row k="Look-through gap">
            Each holding valued at the {span(TWAP_WINDOW)} time-weighted price of its deepest {INDEX.assetSymbol} Uniswap v3 pool (pool.observe, mean tick rounded
            down, tick → price with exact integer math), plus cash, ÷ supply, compared with NAV. It measures whether the holdings trade above or below their oracle
            value; it is not a price of the index token. Spot (slot0) is shown next to it. Last pool activity = the pool&apos;s latest observation time.
          </Row>
          <Row k="History">
            Mint and redeem: the index&apos;s ERC-4626 Deposit and Withdraw events; executed price = assets ÷ tokens from the event; NAV read at the block before
            through an archive endpoint. Samples: NAV and the basket at evenly spaced blocks since deployment. Anything that cannot be read is left out and said.
          </Row>
          <Row k="Tickers">
            A company name is shown only for official stock tokens proven on chain: proxy code hash, the official beacon in the ERC-1967 slot, supply above zero.
            Stock tokens are tokens on {CHAIN.name}, not the shares themselves.
          </Row>
          <Row k={CONTRACT_NAME}>
            {watchLive() ? <A a={CONTRACTS.watch} /> : "Not deployed yet."} Constructor argument: the Uniswap v3 factory {V3_FACTORY_ARG} (every pool is checked
            against it). Tracks: index token + market side (none, a pool of the token, or the basket at pools) + age rules. recordCheckpoint() computes NAV, the
            time-weighted price, both ages and the gap itself and stores them; one per second per track; a track&apos;s pools are fixed after its first checkpoint.
            Rules: direction, threshold in bps, cooldown; evaluate() returns Triggered, Clear, Cooldown or the reason it cannot judge (no market, stale or invalid
            NAV, stale price, holdings not covered); fire() records a crossing once per checkpoint and cooldown. No owner, no fee, no upgrade, no ether, no funds.
          </Row>
          <Row k="Limits">
            Pools can be thin (depth is shown) and a time-weighted price lags fast moves by design. The index can change constituents; history samples taken under
            another constituent list do not draw a basket. Readings are cached up to 30 seconds (served at most 10 minutes old when the chain cannot be reached, with
            the age shown). Nothing here is advice.
          </Row>
        </dl>
        <h2 className="d4 mt-16">Status of each part</h2>
        <div className="mt-6 grid gap-2">
          {FEATURES.map((f) => (
            <div key={f.key} className="card-line grid gap-2 px-5 py-4 md:grid-cols-[260px_1fr_auto] md:items-start">
              <b className="t15 font-medium">{f.name}</b>
              <span className="t14 muted">
                {f.what} <i>{f.limit}</i>
              </span>
              <StatusBadge status={f.status} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function span(s: number) {
  return s % 60 === 0 ? `${s / 60}-minute` : `${s}-second`;
}
