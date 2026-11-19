import type { MetadataRoute } from "next";
import { BRAND } from "@/config/brand";
import { ROUTES } from "@/config/nav";

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((p: string) => ({ url: `${BRAND.url}${p === "/" ? "" : p}` }));
}
