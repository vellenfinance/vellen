"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NAV } from "@/config/nav";
import { Wordmark } from "@/components/site/Mark";
import { CloseIcon } from "@/components/site/Icons";
import { NavWallet } from "@/components/wallet/WalletButton";
import { CaBox } from "@/components/site/CaCopy";
import { useFocusTrap } from "@/components/site/useFocusTrap";

/*
 * Header as the UI reference: wordmark left, centred text links with an outlined pill on the current page, actions right.
 * Every page opens on a dark band, so the header starts cream-on-dark and turns into a cream bar once the page scrolls.
 */
export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <>
      <header className={`vl-header ${scrolled ? "scrolled" : "on-dark"}`} data-testid="header">
        <div className="wrap flex h-[84px] items-center gap-3 md:h-[100px]">
          <Link href="/" aria-label="Vellen home" className="shrink-0">
            <Wordmark />
          </Link>
          <nav aria-label="Main" className="vl-nav hidden flex-1 items-center justify-center gap-2 lg:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={path === n.href || path.startsWith(`${n.href}/`) ? "page" : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex min-w-0 items-center gap-2 lg:ml-0">
            <div className="hidden xl:block">
              <CaBox compact testid="header-ca" />
            </div>
            <NavWallet label="Connect wallet" />
            <button type="button" className="vl-roundbtn lg:hidden" aria-label="Open the menu" aria-expanded={open} onClick={() => setOpen(true)} data-testid="menu-open">
              <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
                <path d="M3 6.5h12M3 11.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </header>
      {open ? <MobileMenu onClose={() => setOpen(false)} path={path} /> : null}
    </>
  );
}

function MobileMenu({ onClose, path }: { onClose: () => void; path: string }) {
  const trap = useRef<HTMLDivElement>(null);
  useFocusTrap(trap, true, onClose);
  // Portal to <body>: the header's backdrop-filter would otherwise clip a fixed overlay to its own box.
  return createPortal(
    <div className="dark fixed inset-0 z-[75] overflow-y-auto bg-[#170605]" role="dialog" aria-modal="true" aria-label="Menu" ref={trap} data-testid="menu">
      <div className="wrap flex h-[84px] items-center justify-between">
        <Wordmark />
        <button type="button" className="vl-roundbtn" aria-label="Close the menu" onClick={onClose}>
          <CloseIcon size={16} />
        </button>
      </div>
      <nav className="wrap mt-4 grid" aria-label="Main">
        {[{ href: "/", label: "Home" }, ...NAV].map((n) => (
          <Link key={n.href} href={n.href} onClick={onClose} className={`border-b border-white/10 py-4 text-[28px] leading-[32px] font-medium ${path === n.href ? "" : "opacity-75"}`}>
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="wrap mt-8 grid gap-3 pb-10">
        <Link href="/gap" className="pill pill-cream lg w-full" onClick={onClose}>
          Open the Gap Watch
        </Link>
        <CaBox testid="menu-ca" />
      </div>
    </div>,
    document.body,
  );
}
