import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { requireShop } from "@/server/owner";
import { restockList } from "@/server/restock";
import { ownerState } from "@/server/session";

import Loading from "../loading";
import { RestockScreen } from "./restock-screen";

// Restock (under My shop): what to order
// from the supplier, fewest days left first, with the quantity, a one-line
// reason and the customer-review flag.
export default function RestockPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Restock />
    </Suspense>
  );
}

async function Restock() {
  const state = await ownerState();
  if (!state) redirect("/");
  if (!state.shop) redirect("/app/welcome");
  const owner = await requireShop();
  const requestId = (await headers()).get("x-request-id") ?? crypto.randomUUID();
  const { items } = await restockList({ ...owner, requestId });
  return <RestockScreen items={items} shopName={state.shop.name} />;
}
