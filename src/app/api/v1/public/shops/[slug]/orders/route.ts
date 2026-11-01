import { z } from "zod";

import { ipHash, limit, verifyTurnstile } from "@/server/abuse";
import { readJson, route } from "@/server/http";
import { NewOrder, placeOrder } from "@/server/orders";

const Body = z.object({ order: NewOrder, turnstileToken: z.string().max(2048) }).strict();

// A customer places an order from the shop page (V-04): no account, a bot
// check, 10 orders an hour per device and 300 a day per shop.
export const POST = route(async (request, ctx: RouteContext<"/api/v1/public/shops/[slug]/orders">, { requestId }) => {
  const { slug } = await ctx.params;
  const ip = ipHash(request);
  await limit(`orders:ip:${ip}`, 10, 3600);
  const { order, turnstileToken } = await readJson(request, Body);
  await verifyTurnstile(turnstileToken, request);
  await limit(`orders:shop:${slug}`, 300, 86_400);
  return Response.json(await placeOrder(slug, order, ip, requestId), { status: 201 });
});
