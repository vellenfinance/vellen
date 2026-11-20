/*
 * Vellen's mark: the owner's V (two slanted strokes over a base bar), from /brand/mark.webp. The file is white on transparent,
 * so it is used as a CSS mask and painted in currentColor: black on the cream ground, cream on the dark bands.
 * Aspect of the trimmed artwork: 381 x 256.
 */
const MARK_RATIO = 381 / 256;

export function MarkGlyph({ size = 22 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="block shrink-0 bg-current"
      style={{
        width: Math.round(size * MARK_RATIO),
        height: size,
        WebkitMaskImage: "url(/brand/mark.webp)",
        maskImage: "url(/brand/mark.webp)",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}

/** Wordmark: the mark + the name. */
export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <MarkGlyph size={Math.round(size * 0.82)} />
      <span className="leading-none font-semibold tracking-[-0.02em]" style={{ fontSize: size }}>
        vellen
      </span>
    </span>
  );
}
