import { z } from "zod";

import { ApiError, fromPostgres, readJson, route } from "@/server/http";
import { requireShop } from "@/server/owner";
import { refreshStorefront } from "@/server/storefront";

const Body = z.object({ published: z.boolean() }).strict();

// Publish or unpublish the storefront (doc 02). Unpublishing is instant
// (doc 03 TH-10).
export const POST = route(async (request, ctx: RouteContext<"/api/v1/shops/[id]/publish">) => {
  const { id } = await ctx.params;
  const { db, shop } = await requireShop();
  if (shop.id !== id) throw new ApiError(404, "NOT_FOUND", "Not found");
  const { published } = await readJson(request, Body);
  const { data, error } = await db.from("shops").update({ is_published: published }).eq("id", id).select("*").single();
  if (error) throw fromPostgres(error);
  refreshStorefront(data.slug);
  return Response.json({ shop: data });
});
