import type { Metadata } from "next";

import { LangProvider } from "@/i18n/lang";

import { StyleGuide } from "./style-guide";

export const metadata: Metadata = {
  title: "Design · Shelf Voice",
  robots: { index: false },
};

// Live style guide (errata E-32): every token and component, in both themes
// and both languages, checked on a phone before screens are built on them.
export default function DesignPage() {
  return (
    <LangProvider initial="en">
      <StyleGuide />
    </LangProvider>
  );
}
