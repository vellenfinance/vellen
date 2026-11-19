import Link from "next/link";
import { PageHead } from "@/components/site/PageHead";

export default function NotFound() {
  return (
    <>
      <PageHead eyebrow="404" title="No price, no NAV, no page.">
        This page does not exist. The Gap Watch is one click away.
      </PageHead>
      <div className="wrap flex flex-wrap justify-center gap-3 py-16">
        <Link href="/gap" className="pill pill-black">
          Open the Gap Watch
        </Link>
        <Link href="/" className="pill pill-line">
          Home
        </Link>
      </div>
    </>
  );
}
