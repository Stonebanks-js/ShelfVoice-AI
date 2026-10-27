import type { Metadata } from "next";
import "./globals.css";

// Fonts (Baloo 2, Mukta), tokens and the app shell arrive with W-06 (doc 06).

export const metadata: Metadata = {
  title: "Shelf Voice",
  description: "Speak your shop online, know what to restock, and hear every customer.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
