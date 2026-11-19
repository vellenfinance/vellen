"use client";

import { useEffect, useRef } from "react";

/* Fades a block up once it scrolls into view. Without JavaScript or with reduced motion it is simply visible. */
export function Reveal({ children, className = "", delay = 0, as: Tag = "div" }: { children: React.ReactNode; className?: string; delay?: number; as?: "div" | "section" | "li" | "article" }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            window.setTimeout(() => el.classList.add("in"), delay);
            io.disconnect();
          }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  const Any = Tag as React.ElementType;
  return (
    <Any ref={ref} className={`bl-reveal ${className}`}>
      {children}
    </Any>
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
