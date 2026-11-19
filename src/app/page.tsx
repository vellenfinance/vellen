import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { Home } from "@/components/home/Home";
import { HOME_DESCRIPTION, HOME_TITLE, appLd, pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({ path: "/", title: HOME_TITLE, description: HOME_DESCRIPTION });

export default function Page() {
  return (
    <>
      <JsonLd data={[appLd]} />
      <Home />
    </>
  );
}
