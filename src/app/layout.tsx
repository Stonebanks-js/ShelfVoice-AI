import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Noto_Sans_Devanagari } from "next/font/google";
import { ViewTransition } from "react";

import { AppInstall } from "@/components/shell/app-install";
import { ClientMonitor } from "@/components/shell/client-monitor";

import "./globals.css";

// Latin text uses the phone's own font; this covers Hindi (errata E-32).
const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-devanagari",
  display: "swap",
});

// Headings, figures and prices (E-37); body text stays on the phone's font.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Shelf Voice",
  description: "Speak your shop online, know what to restock, and hear every customer.",
  // Added to an iPhone's home screen, it opens as an app, not a tab (E-37).
  appleWebApp: { capable: true, title: "Shelf Voice", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets the tab bar sit above the home indicator
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

// `lang` here is the document default; each screen's language provider marks
// its own subtree, so Hindi is announced correctly (doc 06).
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${devanagari.variable} ${bricolage.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg font-sans text-ink">
        {/* Screens change with a short fade and rise (V-10); navigations are
            transitions, so React runs it through the browser's View
            Transitions where they exist and skips it where they don't. */}
        <ViewTransition default="page">{children}</ViewTransition>
        <ClientMonitor />
        <AppInstall />
      </body>
    </html>
  );
}
