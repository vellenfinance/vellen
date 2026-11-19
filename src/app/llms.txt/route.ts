import { BRAND, CHAIN } from "@/config/brand";
import { CONTRACTS, watchLive } from "@/config/contracts";
import { INDEX } from "@/config/index";

export const dynamic = "force-static";

export function GET() {
  const lines = [
    `# ${BRAND.name}`,
    "",
    `> ${BRAND.slogan} ${BRAND.tagline} ${BRAND.name} compares the market price of an IPO index token on ${CHAIN.name} (chain ${CHAIN.id}) with its NAV per token, shows the gap in percent and the age and source of every number. Today no pool trades the index token, so the site reports "no market" and shows the look-through gap (the index's holdings at their own pools' 30-minute TWAP vs NAV). Pre-launch concept with a working prototype; free; no wallet or token needed; not advice; not affiliated with the index, Robinhood or any issuer.`,
    "",
    `Gap Watch: ${BRAND.url}/gap`,
    `Live reading (JSON): ${BRAND.url}/api/gap`,
    `History (JSON): ${BRAND.url}/api/gap/history`,
    `Index token read: ${INDEX.vault}`,
    `VellenGapWatch: ${watchLive() ? CONTRACTS.watch : "not deployed yet"}`,
    `Method: ${BRAND.url}/method`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
