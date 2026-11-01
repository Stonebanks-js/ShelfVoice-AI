import { z } from "zod";

import { ApiError, readJson, route } from "@/server/http";
import { PushSubscription, pushEnabled, removePushSubscription, savePushSubscription } from "@/server/orders";
import { requireShop } from "@/server/owner";

// This phone gets a notification for each new customer order (V-04).
export const POST = route(async (request, _ctx, { requestId }) => {
  if (!pushEnabled()) throw new ApiError(503, "PUSH_OFF", "Order alerts aren't available yet");
  const owner = await requireShop();
  const subscription = await readJson(request, PushSubscription);
  await savePushSubscription({ ...owner, requestId }, subscription);
  return new Response(null, { status: 204 });
});

export const DELETE = route(async (request, _ctx, { requestId }) => {
  const owner = await requireShop();
  const { endpoint } = await readJson(request, z.object({ endpoint: z.url().max(1000) }).strict());
  await removePushSubscription({ ...owner, requestId }, endpoint);
  return new Response(null, { status: 204 });
});
