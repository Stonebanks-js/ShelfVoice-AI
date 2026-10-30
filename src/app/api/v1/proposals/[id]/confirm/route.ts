import { after } from "next/server";
import { z } from "zod";

import { Changes } from "@/server/changes";
import { refreshForecasts } from "@/server/forecast/refresh";
import { readJson, route } from "@/server/http";
import { log } from "@/server/log";
import { requireShop } from "@/server/owner";
import { confirmProposal, touchedProducts } from "@/server/proposals";
import { refreshStorefront } from "@/server/storefront";

const Body = z.object({ changes: Changes.optional() }).strict();

// Apply an owner-approved proposal in one transaction; idempotent by
// proposal ID (doc 02). Forecasts and the storefront refresh afterwards.
export const POST = route(async (request, ctx: RouteContext<"/api/v1/proposals/[id]/confirm">, { requestId }) => {
  const { id } = await ctx.params;
  const owner = await requireShop();
  const { changes } = await readJson(request, Body);
  const applied = await confirmProposal({ ...owner, requestId }, id, changes);

  after(async () => {
    refreshStorefront(owner.shop.slug);
    try {
      await refreshForecasts(owner.shop.id, touchedProducts(applied));
    } catch (error) {
      log("error", "forecast.refresh_failed", { requestId, shopId: owner.shop.id, error });
    }
  });
  return Response.json({ applied });
});
