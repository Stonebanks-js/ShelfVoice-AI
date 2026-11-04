import { setFavourite } from "@/server/customer";
import { ApiError, route } from "@/server/http";
import { requireOwner } from "@/server/owner";

async function slug(ctx: RouteContext<"/api/v1/me/favourites/[slug]">) {
  const { slug: value } = await ctx.params;
  if (!/^[a-z0-9-]{3,48}$/.test(value)) throw new ApiError(404, "NOT_FOUND", "Shop not found");
  return value;
}

// Save a shop as a favourite, or take it off.
export const PUT = route(async (_request, ctx: RouteContext<"/api/v1/me/favourites/[slug]">) => {
  await setFavourite(await requireOwner(), await slug(ctx), true);
  return new Response(null, { status: 204 });
});

export const DELETE = route(async (_request, ctx: RouteContext<"/api/v1/me/favourites/[slug]">) => {
  await setFavourite(await requireOwner(), await slug(ctx), false);
  return new Response(null, { status: 204 });
});
