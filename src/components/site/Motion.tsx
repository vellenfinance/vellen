"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

declare global {
  interface Window {
    __vlMotion?: boolean;
  }
}

/*
 * One motion driver for the whole site, steered by data attributes so markup stays plain and grids keep their own children:
 *   data-reveal[="fade"|"scale"]  blur-up (or fade / scale) once the element enters the viewport
 *   data-stagger                  the same for every direct child, 90 ms apart within one batch
 *   data-words                    words (<Words>) light up one by one while the block crosses the viewport
 *   data-scrub="inset"            a full-bleed panel settles into a 16 px inset card as it scrolls in
 *   data-parallax="0.3"           the element lags behind the scroll by that fraction
 *   data-zoom                     card art scales from 1.16 to 1 while it passes
 *   data-hpin                     on wide screens a horizontal card row is pinned and scrolled sideways
 * The hidden start states only apply under html.mo, which an inline head script sets when motion is allowed and removes again
 * if this driver never starts. Without JavaScript, or with reduced motion, every element is simply visible.
 */

const STEP = 90;
const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

type Pin = { el: HTMLElement; stage: HTMLElement; scroller: HTMLElement; track: HTMLElement; on: boolean; pad: number; h: number; dist: number; travel: number; top: number };

export function Motion() {
  const path = usePathname();
  useEffect(() => {
    window.__vlMotion = true;
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) root.classList.remove("mo");
    if (!root.classList.contains("mo")) return;

    const seen = new WeakSet<Element>();
    const timers: number[] = [];
    const io = new IntersectionObserver(
      (entries) => {
        const batch = new Map<Element, number>();
        const hits: HTMLElement[] = [];
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          hits.push(el);
          // A sideways row arrives as one: cards still off to the right (inside its scroller) come in with it.
          const row = el.parentElement?.hasAttribute("data-hpin-track") ? el.parentElement : null;
          if (row) for (const c of row.children) if (c !== el && !c.hasAttribute("data-shown") && !hits.includes(c as HTMLElement)) hits.push(c as HTMLElement);
        }
        for (const el of hits) {
          if (el.hasAttribute("data-shown")) continue;
          io.unobserve(el);
          const parent = el.parentElement?.hasAttribute("data-stagger") ? el.parentElement : null;
          let d = Number(el.dataset.delay || 0);
          if (parent) {
            const n = batch.get(parent) ?? 0;
            batch.set(parent, n + 1);
            d += n * STEP;
          }
          if (d > 0) timers.push(window.setTimeout(() => el.setAttribute("data-shown", ""), d));
          else el.setAttribute("data-shown", "");
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );

    let scrubs: HTMLElement[] = [];
    let words: { el: HTMLElement; ws: HTMLElement[]; lit: number }[] = [];
    let pins: Pin[] = [];

    const measurePin = (p: Pin) => {
      p.on = false;
      p.el.removeAttribute("data-pinned");
      p.el.style.height = "";
      p.stage.style.top = "";
      p.track.style.transform = "";
      if (window.innerWidth < 1024) return;
      p.scroller.scrollLeft = 0;
      p.dist = p.scroller.scrollWidth - p.scroller.clientWidth;
      p.h = p.stage.offsetHeight;
      if (p.dist < 40 || p.h > window.innerHeight - 40) return;
      p.pad = parseFloat(getComputedStyle(p.el).paddingTop) || 0;
      p.travel = Math.round(p.dist * 1.6);
      p.top = Math.max(0, Math.round((window.innerHeight - p.h) / 2));
      p.el.setAttribute("data-pinned", "");
      p.el.style.height = `${p.pad + p.h + p.travel}px`;
      p.stage.style.top = `${p.top}px`;
      p.on = true;
    };

    const tick = () => {
      raf = 0;
      const vh = window.innerHeight;
      for (const el of scrubs) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        if (el.dataset.scrub === "inset") el.style.setProperty("--p", clamp((vh - r.top) / (vh * 0.7)).toFixed(3));
        if (el.dataset.parallax) el.style.setProperty("--py", `${(-(r.top + r.height / 2 - vh / 2) * Number(el.dataset.parallax)).toFixed(1)}px`);
        if (el.hasAttribute("data-zoom")) el.style.setProperty("--z", (1 + 0.16 * (1 - clamp(((vh - r.top) / (vh + r.height)) * 1.8))).toFixed(4));
      }
      for (const w of words) {
        const r = w.el.getBoundingClientRect();
        const lit = Math.round(clamp((vh * 0.92 - r.top) / (vh * 0.55)) * w.ws.length);
        if (lit === w.lit) continue;
        w.ws.forEach((s, i) => (i < lit ? s.setAttribute("data-lit", "") : s.removeAttribute("data-lit")));
        w.lit = lit;
      }
      for (const p of pins) {
        if (!p.on) continue;
        const r = p.el.getBoundingClientRect();
        const k = clamp((p.top - (r.top + p.pad)) / p.travel);
        p.track.style.transform = `translate3d(${(-k * p.dist).toFixed(1)}px,0,0)`;
      }
    };
    let raf = 0;
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const scan = () => {
      document.querySelectorAll("[data-reveal]:not([data-shown]), [data-stagger] > :not([data-shown])").forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        io.observe(el);
      });
      scrubs = [...document.querySelectorAll<HTMLElement>("[data-scrub], [data-parallax], [data-zoom]")];
      words = [...document.querySelectorAll<HTMLElement>("[data-words]")].map((el) => {
        const old = words.find((w) => w.el === el);
        return old ?? { el, ws: [...el.querySelectorAll<HTMLElement>(".w")], lit: -1 };
      });
      const next: Pin[] = [];
      document.querySelectorAll<HTMLElement>("[data-hpin]").forEach((el) => {
        const old = pins.find((p) => p.el === el);
        if (old) return next.push(old);
        const stage = el.querySelector<HTMLElement>("[data-hpin-stage]");
        const scroller = el.querySelector<HTMLElement>("[data-hpin-scroller]");
        const track = el.querySelector<HTMLElement>("[data-hpin-track]");
        if (!stage || !scroller || !track) return;
        const p: Pin = { el, stage, scroller, track, on: false, pad: 0, h: 0, dist: 0, travel: 0, top: 0 };
        measurePin(p);
        next.push(p);
      });
      pins = next;
      onScroll();
    };

    let mraf = 0;
    const mo = new MutationObserver(() => {
      if (!mraf)
        mraf = requestAnimationFrame(() => {
          mraf = 0;
          scan();
        });
    });
    let rt = 0;
    const onResize = () => {
      window.clearTimeout(rt);
      rt = window.setTimeout(() => {
        pins.forEach(measurePin);
        onScroll();
      }, 150);
    };
    const onReduce = () => {
      if (!reduce.matches) return;
      root.classList.remove("mo");
      pins.forEach((p) => {
        p.el.removeAttribute("data-pinned");
        p.el.style.height = "";
        p.track.style.transform = "";
      });
      stop();
    };
    const stop = () => {
      io.disconnect();
      mo.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(mraf);
      window.clearTimeout(rt);
    };

    scan();
    // Fonts change line lengths and so the pinned row's width.
    document.fonts?.ready.then(() => pins.forEach(measurePin)).catch(() => {});
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    reduce.addEventListener("change", onReduce);
    return () => {
      stop();
      reduce.removeEventListener("change", onReduce);
    };
  }, [path]);
  return null;
}

/** Runs before first paint: opt into the hidden start states only when motion is allowed, and back out if the driver never starts. */
export const MOTION_BOOT = `(function(){try{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var d=document.documentElement;d.classList.add('mo');setTimeout(function(){if(!window.__vlMotion)d.classList.remove('mo')},4000)}catch(e){}})();`;
