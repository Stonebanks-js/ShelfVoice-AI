import { ipHash, limit } from "@/server/abuse";
import { ApiError, route } from "@/server/http";
import { orderForCustomer } from "@/server/orders";

// The customer's order, from the secret link (V-04). The status page polls it.
export const GET = route(async (request, ctx: RouteContext<"/api/v1/public/orders/[id]">) => {
  await limit(`order-status:${ipHash(request)}`, 120, 60);
  const { id } = await ctx.params;
  const order = await orderForCustomer(id, new URL(request.url).searchParams.get("t") ?? "");
  if (!order) throw new ApiError(404, "NOT_FOUND", "Order not found");
  return Response.json({ order });
});
