import { SplitChars } from "@/components/site/Reveal";

const d = (s: number) => ({ "--d": `${s}s` }) as React.CSSProperties;

/* Title band for app pages: the reference's dark warm hero in a shorter form, centred, with a lead and optional actions. */
export function PageHead({ eyebrow, title, children, actions }: { eyebrow: string; title: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="hero dark" style={{ minHeight: 0 }}>
      <div aria-hidden="true" className="hero-art pointer-events-none absolute inset-0" data-parallax="0.3">
        <div className="absolute top-[70%] left-1/2 h-[min(80vw,760px)] w-[min(80vw,760px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
        <div className="absolute top-[78%] left-[72%] h-[min(16vw,160px)] w-[min(16vw,160px)] rounded-full opacity-60 bg-[radial-gradient(circle,#ff9b6e,#e2412c_55%,rgba(226,65,44,0)_72%)] blur-[2px]" />
      </div>
      <div className="wrap relative pt-36 pb-16 text-center md:pt-44 md:pb-20">
        <p className="eyebrow intro" style={d(0.1)}>
          {eyebrow}
        </p>
        <h1 className="d3 mx-auto mt-4 max-w-[980px]">
          <SplitChars text={title} />
        </h1>
        {children ? (
          <div className="t15 muted intro mx-auto mt-5 max-w-[760px] text-[17px] leading-[24px]" style={d(0.55)}>
            {children}
          </div>
        ) : null}
        {actions ? (
          <div className="intro mt-8 flex flex-wrap justify-center gap-3" style={d(0.7)}>
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function StatusBadge({ status }: { status: "Prototype" | "Concept" }) {
  return <span className={`tag ${status === "Prototype" ? "proto" : "concept"}`}>{status}</span>;
}
export function SampleBadge({ label = "Sample data" }: { label?: string }) {
  return <span className="tag sample">{label}</span>;
}
export function LiveBadge({ label = "Live from chain" }: { label?: string }) {
  return (
    <span className="tag live">
      <span className="dot pulse" /> {label}
    </span>
  );
}
