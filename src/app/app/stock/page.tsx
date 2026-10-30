import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PRODUCT_COLUMNS, type StockProduct } from "@/lib/stock";
import { ownerState } from "@/server/session";
import { ownerClient } from "@/server/supabase";

import Loading from "../loading";
import { StockScreen } from "./stock-screen";

// O-6 Stock (doc 06): the catalog with stock levels. Search, category chips,
// each row with price, stock and an in/out switch; tap a row to edit.
export default function StockPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Stock />
    </Suspense>
  );
}

async function Stock() {
  const state = await ownerState();
  if (!state) redirect("/");
  if (!state.shop) redirect("/app/welcome");
  const db = await ownerClient();
  const { data, error } = await db
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("shop_id", state.shop.id)
    .is("archived_at", null)
    .order("name");
  if (error) throw error; // the app's error screen offers Retry
  return <StockScreen initial={data as unknown as StockProduct[]} />;
}
