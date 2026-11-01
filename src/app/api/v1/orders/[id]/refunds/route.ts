import { addRefund, Refund } from "@/server/orders";
import { readJson, route } from "@/server/http";
import { requireShop } from "@/server/owner";

// The owner records a refund on a finished order (V-05); the money goes
// back by cash or UPI, outside the app.
export const POST = route(async (request, ctx: RouteContext<"/api/v1/orders/[id]/refunds">, { requestId }) => {
  const { id } = await ctx.params;
  const owner = await requireShop();
  const refund = await readJson(request, Refund);
  await addRefund({ ...owner, requestId }, id, refund);
  return new Response(null, { status: 201 });
});
