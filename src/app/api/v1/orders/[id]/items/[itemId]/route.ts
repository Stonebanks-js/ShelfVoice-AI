import { z } from "zod";

import { readJson, route } from "@/server/http";
import { setItemStatus } from "@/server/orders";
import { requireShop } from "@/server/owner";

const Body = z.object({ status: z.enum(["AVAILABLE", "UNAVAILABLE"]) }).strict();

// One item of a customer order: the shop has it, or not (V-04).
export const PATCH = route(async (request, ctx: RouteContext<"/api/v1/orders/[id]/items/[itemId]">, { requestId }) => {
  const { id, itemId } = await ctx.params;
  const owner = await requireShop();
  const { status } = await readJson(request, Body);
  await setItemStatus({ ...owner, requestId }, id, itemId, status);
  return new Response(null, { status: 204 });
});
