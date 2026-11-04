import { z } from "zod";

import { deleteShop } from "@/server/delete-shop";
import { fromPostgres, readJson, route } from "@/server/http";
import { bothOrNeither, ShopLocation } from "@/server/location";
import { requireOwner, requireShop } from "@/server/owner";
import { refreshStorefront } from "@/server/storefront";
import { type Lang, LANGS } from "@/i18n/dictionary";

// The signed-in owner and their shop (null until created).
export const GET = route(async () => {
  const { db, user } = await requireOwner();
  const { data: shop } = await db.from("shops").select("*").maybeSingle();
  return Response.json({ user: { id: user.id, isAnonymous: user.is_anonymous ?? false }, shop });
});

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
// Opening hours per day: up to two open-close pairs; an empty list is closed.
const Hours = z
  .object(Object.fromEntries(DAYS.map((d) => [d, z.array(z.array(time).length(2)).max(2)])))
  .strict();

const Patch = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    category: z.string().trim().max(80).nullable().optional(),
    phone: z.string().regex(/^\+[1-9][0-9]{6,14}$/).nullable().optional(),
    description: z.string().trim().max(500).nullable().optional(),
    hours: Hours.nullable().optional(),
    language: z.enum(LANGS as [Lang, ...Lang[]]).optional(),
    delivers: z.boolean().optional(),
    // Payments and delivery.
    upi_id: z.string().trim().regex(/^[A-Za-z0-9._-]{2,64}@[A-Za-z]{2,64}$/).nullable().optional(),
    accepts_cash: z.boolean().optional(),
    pay_on_delivery: z.boolean().optional(),
    delivery_min_paise: z.number().int().min(0).max(10_000_000).nullable().optional(),
    delivery_fee_paise: z.number().int().min(0).max(1_000_000).nullable().optional(),
    free_delivery_above_paise: z.number().int().min(0).max(10_000_000).nullable().optional(),
    delivery_radius_km: z.number().min(0.5).max(50).nullable().optional(),
    ...ShopLocation,
  })
  .strict()
  .refine(bothOrNeither, { message: "Latitude and longitude go together", path: ["lat"] });

// Edit shop details from My shop, under the owner's RLS.
export const PATCH = route(async (request) => {
  const { db, shop } = await requireShop();
  const body = await readJson(request, Patch);
  const { data, error } = await db.from("shops").update(body).eq("id", shop.id).select("*").single();
  if (error) throw fromPostgres(error);
  refreshStorefront(shop.slug);
  return Response.json({ shop: data });
});

// Delete my shop: shop, files and account, then signed out.
export const DELETE = route(async (_request, _ctx, { requestId }) => {
  const { db, user, shop } = await requireShop();
  await deleteShop({ shopId: shop.id, userId: user.id, requestId });
  refreshStorefront(shop.slug);
  await db.auth.signOut(); // clears the session cookie
  return new Response(null, { status: 204 });
});
