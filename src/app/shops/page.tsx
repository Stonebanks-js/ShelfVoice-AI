import type { Metadata } from "next";
import { Suspense } from "react";

import { LangRoot } from "@/i18n/lang-root";
import { requestLang } from "@/server/session";

import { ShopFinder } from "./shop-finder";

export const metadata: Metadata = { title: "Shops near you · Shelf Voice" };

// Customers find shops near them (V-03, E-36), without signing in.
export default function ShopsPage() {
  return (
    <Suspense>
      <Shops />
    </Suspense>
  );
}

async function Shops() {
  return (
    <LangRoot initial={await requestLang()}>
      <ShopFinder />
    </LangRoot>
  );
}
