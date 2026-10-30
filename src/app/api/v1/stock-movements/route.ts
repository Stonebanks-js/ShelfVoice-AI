import { after } from "next/server";
import { z } from "zod";

import { refreshForecasts } from "@/server/forecast/refresh";
import { ApiError, fromPostgres, readJson, route } from "@/server/http";
import { log } from "@/server/log";
import { requireShop } from "@/server/owner";
import { refreshStorefront } from "@/server/storefront";

const Body = z
  .object({
    product_id: z.uuid(),
    kind: z.enum(["SALE", "DELIVERY", "CORRECTION"]),
    qty: z.number().int().min(-10_000).max(10_000).refine((n) => n !== 0, "qty can't be 0"),
    unit_price_paise: z.number().int().positive().max(10_000_000).nullable().optional(),
    // Client UUID per tap, so a double tap logs once (doc 07 idempotency).
    idempotency_key: z.uuid(),
  })
  .strict()
  .refine((b) => b.kind === "CORRECTION" || b.qty > 0, { message: "Sales and deliveries are positive", path: ["qty"] });

// Tap-to-log a sale, delivery or count correction (doc 02, FR-06). The stock
// trigger refuses anything that would take stock below zero.
export const POST = route(async (request, _ctx, { requestId }) => {
  const { db, shop } = await requireShop();
  const body = await readJson(request, Body);
  const { data, error } = await db
    .from("stock_movements")
    .insert({ ...body, shop_id: shop.id, source: "TAP" })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      // Same tap again: return the movement already logged.
      const { data: prior } = await db.from("stock_movements").select("*").eq("shop_id", shop.id).eq("idempotency_key", body.idempotency_key).single();
      return Response.json({ movement: prior });
    }
    if (error.hint === "STOCK_NEGATIVE" || error.code === "23514") {
      throw new ApiError(409, "STOCK_NEGATIVE", "Stock would go below zero; correct the count first");
    }
    throw fromPostgres(error);
  }

  after(async () => {
    refreshStorefront(shop.slug);
    try {
      await refreshForecasts(shop.id, [body.product_id]);
    } catch (error) {
      log("error", "forecast.refresh_failed", { requestId, shopId: shop.id, error });
    }
  });
  return Response.json({ movement: data }, { status: 201 });
});
