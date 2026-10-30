import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { requireShop } from "@/server/owner";
import { restockList } from "@/server/restock";
import { ownerState } from "@/server/session";

import Loading from "../loading";
import { OrdersScreen } from "./orders-screen";

// O-7 Order list (doc 06): what to restock, fewest days left first, with
// the quantity, a one-line reason and the customer-review flag.
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
  const owner = await requireShop();
  const requestId = (await headers()).get("x-request-id") ?? crypto.randomUUID();
  const { items } = await restockList({ ...owner, requestId });
  return <OrdersScreen items={items} shopName={state.shop.name} />;
}
