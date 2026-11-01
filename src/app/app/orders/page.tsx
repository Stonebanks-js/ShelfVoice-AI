import { redirect } from "next/navigation";
import { Suspense } from "react";

import { env } from "@/env/server";
import { pushEnabled } from "@/server/orders";
import { ownerState } from "@/server/session";
import { ownerClient } from "@/server/supabase";

import Loading from "../loading";
import { CustomerOrders, type OwnerOrder } from "./customer-orders";

// Customer orders (V-04): new ones first, then the ones being packed, then
// today's finished ones. Read under the owner's RLS.
export default function OrdersPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Orders />
    </Suspense>
  );
}

async function Orders() {
  const state = await ownerState();
  if (!state) redirect("/");
  if (!state.shop) redirect("/app/welcome");
  const db = await ownerClient();
  const now = new Date(); // one clock for the screen
  const since = new Date(now.getTime() - 24 * 3_600_000).toISOString();
  const { data, error } = await db
    .from("orders")
    .select(
      "id, code, status, customer_name, customer_phone, fulfilment, address, note, created_at, delivery_fee_paise, order_items(id, name, unit, price_paise, qty, status, position), order_refunds(amount_paise, reason, created_at)",
    )
    .eq("shop_id", state.shop.id)
    .or(`status.in.(NEW,ACCEPTED,READY),created_at.gte.${since}`)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error; // the app's error screen offers Retry
  const orders: OwnerOrder[] = data.map((o) => ({ ...o, order_items: [...o.order_items].sort((a, b) => a.position - b.position) }));
  return <CustomerOrders orders={orders} shopName={state.shop.name} vapidKey={pushEnabled() ? env.VAPID_PUBLIC_KEY! : null} />;
}
