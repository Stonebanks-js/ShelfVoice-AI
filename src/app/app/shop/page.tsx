import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { env } from "@/env/server";
import { asHours } from "@/lib/hours";
import { pushEnabled } from "@/server/orders";
import { ownerState } from "@/server/session";
import { ownerClient } from "@/server/supabase";

import Loading from "../loading";
import { ShopScreen } from "./shop-screen";

// O-9 My shop (doc 06): storefront preview, products and stock (V-02),
// publish switch, review QR, share link, details and hours, language, sign
// out and delete. Its own tab since V-02.
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
  const [{ data: shop, error }, { count, error: countError }] = await Promise.all([
    db
      .from("shops")
      .select("id, name, slug, category, phone, address, description, hours, timezone, is_published, pincode, lat, lng, delivers, upi_id, accepts_cash, pay_on_delivery, delivery_min_paise, delivery_fee_paise, free_delivery_above_paise, delivery_radius_km")
      .eq("id", state.shop.id)
      .single(),
    db.from("products").select("id", { count: "exact", head: true }).eq("shop_id", state.shop.id).is("archived_at", null),
  ]);
  if (error) throw error;
  if (countError) throw countError;
  // Absolute links for the share sheet and the printed QR.
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const { data: auth } = await db.auth.getUser();
  return (
    <ShopScreen
      shop={{ ...shop, hours: asHours(shop.hours), delivery_radius_km: shop.delivery_radius_km === null ? null : Number(shop.delivery_radius_km) }}
      origin={origin}
      productCount={count ?? 0}
      email={auth.user?.email ?? null}
      vapidKey={pushEnabled() ? env.VAPID_PUBLIC_KEY! : null}
    />
  );
}
