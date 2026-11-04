import { redirect } from "next/navigation";
import { Suspense } from "react";

import { haveKey, typeForCategory } from "@/lib/catalog/starter";
import { ownerState } from "@/server/session";
import { ownerClient } from "@/server/supabase";

import Loading from "../../loading";
import { ListPicker } from "./list-picker";

// Ready-made list for the shop's type, marking what it already has.
export default function ListPage() {
  return (
    <Suspense fallback={<Loading />}>
      <List />
    </Suspense>
  );
}

async function List() {
  const state = await ownerState();
  if (!state) redirect("/");
  if (!state.shop) redirect("/app/welcome");
  const db = await ownerClient();
  const { data, error } = await db.from("products").select("name, unit").eq("shop_id", state.shop.id).is("archived_at", null);
  if (error) throw error; // the app's error screen offers Retry
  return <ListPicker initialType={typeForCategory(state.shop.category)} have={data.map((p) => haveKey(p.name, p.unit))} />;
}
