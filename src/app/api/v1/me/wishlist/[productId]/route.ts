import { z } from "zod";

import { setWishlisted } from "@/server/customer";
import { ApiError, route } from "@/server/http";
import { requireOwner } from "@/server/owner";

async function productId(ctx: RouteContext<"/api/v1/me/wishlist/[productId]">) {
  const { productId: value } = await ctx.params;
  if (!z.uuid().safeParse(value).success) throw new ApiError(404, "NOT_FOUND", "Product not found");
  return value;
}

// Save a product to the wishlist, or take it off.
export const PUT = route(async (_request, ctx: RouteContext<"/api/v1/me/wishlist/[productId]">) => {
  await setWishlisted(await requireOwner(), await productId(ctx), true);
  return new Response(null, { status: 204 });
});

export const DELETE = route(async (_request, ctx: RouteContext<"/api/v1/me/wishlist/[productId]">) => {
  await setWishlisted(await requireOwner(), await productId(ctx), false);
  return new Response(null, { status: 204 });
});
