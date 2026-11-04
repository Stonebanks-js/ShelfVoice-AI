import type { Metadata } from "next";
import { Suspense } from "react";

import { LangRoot } from "@/i18n/lang-root";
import { requestLang } from "@/server/session";

import { LiveOrderView } from "./live-order-view";

export const metadata: Metadata = { title: "Your order · Shelf Voice", robots: { index: false, follow: false } };

// An order on its way: placed, the delivery time and a live tracker.
// Read from this phone only (lib/live-orders), so the page itself is the
// same for everyone.
export default function LiveOrderPage() {
  return (
    <Suspense>
      <Live />
    </Suspense>
  );
}

async function Live() {
  return (
    <LangRoot initial={await requestLang()}>
      <LiveOrderView />
    </LangRoot>
  );
}
