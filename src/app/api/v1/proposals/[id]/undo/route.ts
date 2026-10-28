import { revalidateTag } from "next/cache";
import { after } from "next/server";

import { refreshForecasts } from "@/server/forecast/refresh";
import { route } from "@/server/http";
import { log } from "@/server/log";
import { requireShop } from "@/server/owner";
import { touchedProducts, undoProposal } from "@/server/proposals";

// Reverse a confirmed proposal within the undo window (errata E-02).
export const POST = route(async (_request, ctx: RouteContext<"/api/v1/proposals/[id]/undo">, { requestId }) => {
  const { id } = await ctx.params;
  const owner = await requireShop();
  const reverted = await undoProposal({ ...owner, requestId }, id);

  after(async () => {
    revalidateTag(`storefront:${owner.shop.slug}`, "max");
    try {
      await refreshForecasts(owner.shop.id, touchedProducts(reverted));
    } catch (error) {
      log("error", "forecast.refresh_failed", { requestId, shopId: owner.shop.id, error });
    }
  });
  return Response.json({ reverted });
});
