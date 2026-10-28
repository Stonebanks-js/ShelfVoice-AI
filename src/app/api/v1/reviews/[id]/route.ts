import { z } from "zod";

import { ApiError, fromPostgres, readJson, route } from "@/server/http";
import { requireShop } from "@/server/owner";

const Body = z.object({ is_hidden: z.boolean() }).strict();

// Owners can hide a review, never edit what a customer said (doc 03).
export const PATCH = route(async (request, ctx: RouteContext<"/api/v1/reviews/[id]">) => {
  const { id } = await ctx.params;
  const { db } = await requireShop();
  const { is_hidden } = await readJson(request, Body);
  const { data, error } = await db.from("reviews").update({ is_hidden }).eq("id", id).select("id, is_hidden").maybeSingle();
  if (error) throw fromPostgres(error);
  if (!data) throw new ApiError(404, "NOT_FOUND", "Review not found");
  return Response.json({ review: data });
});
