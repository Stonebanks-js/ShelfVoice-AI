import type { Metadata } from "next";
import { Suspense } from "react";

import { LangProvider } from "@/i18n/lang";
import { requestLang } from "@/server/session";

import { HelpView } from "./help-view";

export const metadata: Metadata = { title: "Help · Shelf Voice" };

// Help for shop owners (V-05): short answers to what they ask most.
export default function HelpPage() {
  return (
    <Suspense>
      <Help />
    </Suspense>
  );
}

async function Help() {
  return (
    <LangProvider initial={await requestLang()}>
      <HelpView />
    </LangProvider>
  );
}
