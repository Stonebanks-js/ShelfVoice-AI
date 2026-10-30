import { revalidateTag } from "next/cache";
import { z } from "zod";

import { deleteShop } from "@/server/delete-shop";
import { fromPostgres, readJson, route } from "@/server/http";
import { requireOwner, requireShop } from "@/server/owner";

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
    address: z.string().trim().max(300).nullable().optional(),
    description: z.string().trim().max(500).nullable().optional(),
    hours: Hours.nullable().optional(),
    language: z.enum(["hi", "en"]).optional(),
  })
  .strict();

// Edit shop details from My shop (doc 06 O-9), under the owner's RLS.
export const PATCH = route(async (request) => {
  const { db, shop } = await requireShop();
  const body = await readJson(request, Patch);
  const { data, error } = await db.from("shops").update(body).eq("id", shop.id).select("*").single();
  if (error) throw fromPostgres(error);
  revalidateTag(`storefront:${shop.slug}`, "max");
  return Response.json({ shop: data });
});

// Delete my shop (doc 01 FR-16): shop, files and account, then signed out.
export const DELETE = route(async (_request, _ctx, { requestId }) => {
  const { db, user, shop } = await requireShop();
  await deleteShop({ shopId: shop.id, userId: user.id, requestId });
  revalidateTag(`storefront:${shop.slug}`, "max");
  await db.auth.signOut(); // clears the session cookie
  return new Response(null, { status: 204 });
});
