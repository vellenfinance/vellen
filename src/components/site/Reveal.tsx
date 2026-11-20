/*
 * Markup helpers for the motion driver (Motion.tsx). They only add data attributes and spans; nothing is hidden unless the driver
 * is running, so without JavaScript or with reduced motion everything reads normally.
 */

type Tag = "div" | "section" | "li" | "article" | "p" | "h2";

/** Blurs and fades a block up once it scrolls into view. `delay` in ms. */
export function Reveal({
  children,
  className = "",
  delay = 0,
  kind,
  as: El = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  kind?: "fade" | "scale";
  as?: Tag;
}) {
  return (
    <El className={className || undefined} data-reveal={kind ?? ""} data-delay={delay || undefined}>
      {children}
    </El>
  );
}

/** Splits plain text into word spans that the driver lights up while the block crosses the viewport (parent needs data-words). */
export function Words({ text }: { text: string }) {
  const parts = text.split(/(\s+)/);
  return (
    <>
      {parts.map((p, i) =>
        /^\s+$/.test(p) || p === "" ? (
          p
        ) : (
          <span key={i} className="w">
            {p}
          </span>
        ),
      )}
    </>
  );
}

/** A headline whose characters arrive one after another on load (pure CSS; the real text stays readable to screen readers). */
export function SplitChars({ text, start = 0 }: { text: string; start?: number }) {
  let n = start;
  const words = text.split(" ");
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="chars">
        {words.map((w, wi) => (
          <span key={wi}>
            <span className="wd">
              {[...w].map((c, ci) => (
                <span key={ci} className="c" style={{ "--i": n++ } as React.CSSProperties}>
                  {c}
                </span>
              ))}
            </span>
            {wi < words.length - 1 ? " " : null}
          </span>
        ))}
      </span>
    </>
  );
}

/** A button label that rolls up on hover (two copies of the text, the second hidden from screen readers). */
export function Roll({ children }: { children: string }) {
  return (
    <span className="roll">
      <span>{children}</span>
      <span aria-hidden="true">{children}</span>
    </span>
  );
}
