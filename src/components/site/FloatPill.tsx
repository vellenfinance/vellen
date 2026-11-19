"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, CloseIcon } from "@/components/site/Icons";

/* The reference's floating call-to-action pill, bottom right, dismissible for the visit. Hidden on the Gap Watch itself. */
export function FloatPill() {
  const path = usePathname();
  const [hidden, setHidden] = useState(true);
  const [far, setFar] = useState(false);
  // On phones it shows only on the home page, and below 1024 px only on the first screen, so it never sits on top of content.
  useEffect(() => {
    const on = () => setFar((window.innerWidth < 768 && window.location.pathname !== "/") || (window.innerWidth < 1024 && window.scrollY > window.innerHeight * 0.6));
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, [path]);
  useEffect(() => {
    let off = false;
    try {
      off = sessionStorage.getItem("vl-float") === "off";
    } catch {
      // storage blocked: show it
    }
    const t = window.setTimeout(() => setHidden(off), 1200);
    return () => window.clearTimeout(t);
  }, []);
  if (hidden || far || path === "/gap" || path === "/deploy") return null;
  return (
    <div className="floatpill" data-testid="float-pill">
      <button
        type="button"
        className="x"
        aria-label="Hide"
        onClick={() => {
          setHidden(true);
          try {
            sessionStorage.setItem("vl-float", "off");
          } catch {
            // ignore
          }
        }}
      >
        <CloseIcon size={13} />
      </button>
      <span className="truncate">Holding an index token? Check its gap</span>
      <Link href="/gap" className="go" aria-label="Open the Gap Watch">
        <ArrowRight size={14} />
      </Link>
    </div>
  );
}
