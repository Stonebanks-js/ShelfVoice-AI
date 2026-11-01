import type { Metadata } from "next";
import { Suspense } from "react";

import { LangProvider } from "@/i18n/lang";
import { orderForCustomer } from "@/server/orders";
import { requestLang } from "@/server/session";

import { OrderStatusView } from "./order-status";

export const metadata: Metadata = { title: "Your order · Shelf Voice", robots: { index: false, follow: false }, referrer: "no-referrer" };

// The customer's order (V-04), from the secret link they got on placing it.
export default function OrderPage({ params, searchParams }: PageProps<"/o/[id]">) {
  return (
    <Suspense>
      <Order params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Order({ params, searchParams }: Pick<PageProps<"/o/[id]">, "params" | "searchParams">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const token = typeof query.t === "string" ? query.t : "";
  const order = await orderForCustomer(id, token);
  const lang = order ? (order.shop.language === "en" ? "en" : "hi") : await requestLang();
  return (
    <LangProvider initial={lang}>
      <OrderStatusView initial={order} token={token} />
    </LangProvider>
  );
}
