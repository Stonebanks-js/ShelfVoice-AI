import { z } from "zod";

import { readJson, route } from "@/server/http";
import { setOrderStatus } from "@/server/orders";
import { requireShop } from "@/server/owner";

const Body = z.object({ status: z.enum(["ACCEPTED", "READY", "COMPLETED", "CANCELLED"]) }).strict();

// The owner moves a customer order along: accept, ready, done, cancel.
export const PATCH = route(async (request, ctx: RouteContext<"/api/v1/orders/[id]">, { requestId }) => {
  const { id } = await ctx.params;
  const owner = await requireShop();
  const { status } = await readJson(request, Body);
  await setOrderStatus({ ...owner, requestId }, id, status);
  return new Response(null, { status: 204 });
});
