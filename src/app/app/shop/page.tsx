import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { asHours } from "@/lib/hours";
import { ownerState } from "@/server/session";
import { ownerClient } from "@/server/supabase";

import Loading from "../loading";
import { ShopScreen } from "./shop-screen";

// O-9 My shop (doc 06): storefront preview, publish switch, review QR, share
// link, details and hours, language, sign out and delete. Opens from the
// shop name on Today.
export default function ShopPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Shop />
    </Suspense>
  );
}

async function Shop() {
  const state = await ownerState();
  if (!state) redirect("/");
  if (!state.shop) redirect("/app/welcome");
  const db = await ownerClient();
  const { data: shop, error } = await db
    .from("shops")
    .select("id, name, slug, category, phone, address, description, hours, timezone, is_published, is_demo, demo_expires_at")
    .eq("id", state.shop.id)
    .single();
  if (error) throw error;
  // Absolute links for the share sheet and the printed QR.
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  return <ShopScreen shop={{ ...shop, hours: asHours(shop.hours) }} origin={origin} />;
}
