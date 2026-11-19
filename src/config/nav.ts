export const NAV = [
  { href: "/gap", label: "Gap Watch" },
  { href: "/rules", label: "Rules" },
  { href: "/method", label: "Method" },
  { href: "/token", label: "Token" },
] as const;

/** Every public route, for the sitemap. */
export const ROUTES = ["/", "/gap", "/rules", "/method", "/token"] as const;
