/* Title band for app pages: the reference's dark warm hero in a shorter form, centred, with a lead and optional actions. */
export function PageHead({ eyebrow, title, children, actions }: { eyebrow: string; title: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="hero dark" style={{ minHeight: 0 }}>
      <div className="wrap pt-36 pb-16 text-center md:pt-44 md:pb-20">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="d3 mx-auto mt-4 max-w-[980px]">{title}</h1>
        {children ? <div className="t15 muted mx-auto mt-5 max-w-[760px] text-[17px] leading-[24px]">{children}</div> : null}
        {actions ? <div className="mt-8 flex flex-wrap justify-center gap-3">{actions}</div> : null}
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
