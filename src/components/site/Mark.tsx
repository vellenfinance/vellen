/*
 * Vellen's mark (AI-made placeholder until the owner's artwork arrives, see referensi/tools/apply-owner-assets.mjs): a ring
 * for NAV and a solid dot pulled off it for the market price, the gap between them being the whole product. Drawn in
 * currentColor, so it works on the cream ground and on the dark bands.
 */
export function MarkGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="block shrink-0">
      <circle cx="10" cy="13.5" r="7.6" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="17.6" cy="6.4" r="4.4" fill="currentColor" />
    </svg>
  );
}

/** Wordmark: the mark + the name. */
export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <MarkGlyph size={Math.round(size * 1.05)} />
      <span className="leading-none font-semibold tracking-[-0.02em]" style={{ fontSize: size }}>
        vellen
      </span>
    </span>
  );
}
