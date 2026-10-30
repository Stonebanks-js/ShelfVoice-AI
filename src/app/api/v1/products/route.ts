import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { refreshForecasts } from "@/server/forecast/refresh";
import { fromPostgres, readJson, route } from "@/server/http";
import { log } from "@/server/log";
import { requireShop } from "@/server/owner";

// Owner catalog with stock and forecast (Stock tab, doc 06 O-6).
export const GET = route(async () => {
  const { db, shop } = await requireShop();
  const { data, error } = await db
    .from("products")
    .select("*, product_forecasts(level, days_left, reorder_point, order_qty, stockout_boost_until, computed_at)")
    .eq("shop_id", shop.id)
    .is("archived_at", null)
    .order("category", { nullsFirst: false })
    .order("name");
  if (error) throw fromPostgres(error);
  return Response.json({ products: data });
});

const NewProduct = z
  .object({
    name: z.string().trim().min(1).max(80),
    unit: z.string().trim().max(40).nullable().optional(),
    category: z.string().trim().max(80).nullable().optional(),
    price_paise: z.number().int().positive().max(10_000_000).nullable().optional(),
    aliases: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
    stock_qty: z.number().int().min(0).max(10_000).nullable().optional(),
    low_stock_level: z.number().int().min(0).max(10_000).optional(),
    pack_size: z.number().int().min(1).max(10_000).optional(),
  })
  .strict();

// Add a product by tap (doc 02: direct catalog edits by tap). Its forecast
// row is made right away, so a low count warns today, not after the nightly job.
export const POST = route(async (request, _ctx, { requestId }) => {
  const { db, shop } = await requireShop();
  const body = await readJson(request, NewProduct);
  const { data, error } = await db
    .from("products")
    .insert({ ...body, shop_id: shop.id, is_in_stock: body.stock_qty === undefined || body.stock_qty === null || body.stock_qty > 0 })
    .select("*")
    .single();
  if (error) throw fromPostgres(error);
  revalidateTag(`storefront:${shop.slug}`, "max");
  after(async () => {
    try {
      await refreshForecasts(shop.id, [data.id]);
    } catch (failure) {
      log("error", "forecast.refresh_failed", { requestId, shopId: shop.id, error: failure });
    }
  });
  return Response.json({ product: data }, { status: 201 });
});
