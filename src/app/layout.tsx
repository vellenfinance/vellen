import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { JsonLd } from "@/components/JsonLd";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { FloatPill } from "@/components/site/FloatPill";
import { MOTION_BOOT, Motion } from "@/components/site/Motion";
import { WalletModalProvider } from "@/components/wallet/WalletButton";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { BRAND } from "@/config/brand";
import { HOME_DESCRIPTION, HOME_TITLE, siteLd } from "@/lib/seo";

// Self-hosted, SIL Open Font License (src/fonts/OFL-*.txt).
const ui = localFont({ src: [{ path: "../fonts/hanken-grotesk-latin-variable.woff2", weight: "300 700", style: "normal" }], variable: "--font-ui", display: "swap" });
const figures = localFont({
  src: [
    { path: "../fonts/ibm-plex-mono-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ibm-plex-mono-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-figures",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.url),
  title: { default: HOME_TITLE, template: `%s | ${BRAND.name}` },
  description: HOME_DESCRIPTION,
  applicationName: BRAND.name,
};

export const viewport: Viewport = { themeColor: "#fcf8f1", colorScheme: "light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${figures.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets html.mo before first paint so scroll reveals start hidden only when motion is allowed (see Motion.tsx). */}
        <script dangerouslySetInnerHTML={{ __html: MOTION_BOOT }} />
      </head>
      <body>
        <a className="bl-skip" href="#main">
          Skip to content
        </a>
        <JsonLd data={siteLd} />
        <WalletProvider>
          <WalletModalProvider>
            <SiteHeader />
            <main id="main">{children}</main>
            <SiteFooter />
            <FloatPill />
            <Motion />
          </WalletModalProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
