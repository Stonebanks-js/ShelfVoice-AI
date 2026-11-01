import { z } from "zod";

import { ApiError, fromPostgres, readJson, route } from "@/server/http";
import { bothOrNeither, ShopLocation } from "@/server/location";
import { requireOwner } from "@/server/owner";
import { slugFor } from "@/server/shops";
import { type Lang, LANGS } from "@/i18n/dictionary";

const Body = z
  .object({
    name: z.string().trim().min(1).max(80).default("My shop"),
    language: z.enum(LANGS as [Lang, ...Lang[]]).optional(),
    // The setup steps (V-03): shop type, and where the shop is.
    category: z.string().trim().max(80).nullable().optional(),
    ...ShopLocation,
  })
  .strict()
  .refine(bothOrNeither, { message: "Latitude and longitude go together", path: ["lat"] });

// Creates the signed-in owner's shop from the setup steps. RLS allows one
// shop per owner and none for anonymous users (E-29).
export const POST = route(async (request) => {
  const { db, user } = await requireOwner();
  const { name, language, ...rest } = await readJson(request, Body);
  const { data, error } = await db
    .from("shops")
    .insert({ owner_id: user.id, name, slug: slugFor(name), ...(language ? { language } : {}), ...rest })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new ApiError(409, "SHOP_EXISTS", "You already have a shop");
    throw fromPostgres(error);
  }
  return Response.json({ shop: data }, { status: 201 });
});
