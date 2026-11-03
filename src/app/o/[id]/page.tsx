import type { Metadata } from "next";
import { Suspense } from "react";

import { LangRoot } from "@/i18n/lang-root";
import { orderForCustomer } from "@/server/orders";
import { currentUser } from "@/server/owner";
import { customerLang, requestLang } from "@/server/session";

import { OrderStatusView } from "./order-status";
import { isLang } from "@/i18n/dictionary";

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
  const user = await currentUser();
  const order = await orderForCustomer(id, token, user?.user.id ?? null);
  const lang = order && isLang(order.shop.language) ? await customerLang(order.shop.language) : await requestLang();
  return (
    <LangRoot initial={lang}>
      <OrderStatusView initial={order} token={token} />
    </LangRoot>
  );
}
