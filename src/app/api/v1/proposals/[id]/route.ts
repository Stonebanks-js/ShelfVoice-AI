import { ApiError, route } from "@/server/http";
import { requireShop } from "@/server/owner";

export const GET = route(async (_request, ctx: RouteContext<"/api/v1/proposals/[id]">) => {
  const { id } = await ctx.params;
  const { db } = await requireShop();
  const { data } = await db.from("proposals").select("*").eq("id", id).maybeSingle();
  if (!data) throw new ApiError(404, "PROPOSAL_NOT_FOUND", "Proposal not found");
  return Response.json({ proposal: data });
});
