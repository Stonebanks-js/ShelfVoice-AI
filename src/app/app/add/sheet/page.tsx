import { redirect } from "next/navigation";
import { Suspense } from "react";

import { haveKey } from "@/lib/catalog/starter";
import { ownerState } from "@/server/session";
import { ownerClient } from "@/server/supabase";

import Loading from "../../loading";
import { SheetImport } from "./sheet-import";

// V-01 products from an Excel or CSV file.
export default function SheetPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Sheet />
    </Suspense>
  );
}

async function Sheet() {
  const state = await ownerState();
  if (!state) redirect("/");
  if (!state.shop) redirect("/app/welcome");
  const db = await ownerClient();
  const { data, error } = await db.from("products").select("name, unit").eq("shop_id", state.shop.id).is("archived_at", null);
  if (error) throw error; // the app's error screen offers Retry
  return <SheetImport have={data.map((p) => haveKey(p.name, p.unit))} />;
}
