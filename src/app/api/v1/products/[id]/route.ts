import { revalidateTag } from "next/cache";
import { z } from "zod";

import { priceChangeAllowed } from "@/server/changes";
import { ApiError, fromPostgres, readJson, route } from "@/server/http";
import { requireShop } from "@/server/owner";

// Stock counts change only through the movement log (decision K2), so a tap
// edit can't set stock_qty directly; use POST /stock-movements instead.
const Patch = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    unit: z.string().trim().max(40).nullable().optional(),
    category: z.string().trim().max(80).nullable().optional(),
    price_paise: z.number().int().positive().max(10_000_000).nullable().optional(),
    aliases: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
    is_in_stock: z.boolean().optional(),
    is_published: z.boolean().optional(),
    low_stock_level: z.number().int().min(0).max(10_000).optional(),
    pack_size: z.number().int().min(1).max(10_000).optional(),
  })
  .strict();

export const PATCH = route(async (request, ctx: RouteContext<"/api/v1/products/[id]">) => {
  const { id } = await ctx.params;
  const { db, shop } = await requireShop();
  const body = await readJson(request, Patch);
  if (body.price_paise) {
    const { data: current } = await db.from("products").select("price_paise").eq("id", id).maybeSingle();
    if (current && !priceChangeAllowed(current.price_paise, body.price_paise)) {
      throw new ApiError(422, "PRICE_OUT_OF_RANGE", "That price looks wrong, please check it");
    }
  }
  const { data, error } = await db.from("products").update(body).eq("id", id).is("archived_at", null).select("*").maybeSingle();
  if (error) throw fromPostgres(error);
  if (!data) throw new ApiError(404, "NOT_FOUND", "Product not found");
  revalidateTag(`storefront:${shop.slug}`, "max");
  return Response.json({ product: data });
});

// Removing a product archives it, so its sales history stays for forecasts.
export const DELETE = route(async (_request, ctx: RouteContext<"/api/v1/products/[id]">) => {
  const { id } = await ctx.params;
  const { db, shop } = await requireShop();
  const { data, error } = await db
    .from("products")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw fromPostgres(error);
  if (!data) throw new ApiError(404, "NOT_FOUND", "Product not found");
  revalidateTag(`storefront:${shop.slug}`, "max");
  return new Response(null, { status: 204 });
});
