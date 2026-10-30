import type { Metadata, Viewport } from "next";
import { Noto_Sans_Devanagari } from "next/font/google";

import { ClientMonitor } from "@/components/shell/client-monitor";

import "./globals.css";

// Latin text uses the phone's own font; this covers Hindi (errata E-32).
const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-devanagari",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Shelf Voice",
  description: "Speak your shop online, know what to restock, and hear every customer.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets the tab bar sit above the home indicator
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

// `lang` here is the document default; each screen's language provider marks
// its own subtree, so Hindi is announced correctly (doc 06).
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${devanagari.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg font-sans text-ink">
        {children}
        <ClientMonitor />
      </body>
    </html>
  );
}
