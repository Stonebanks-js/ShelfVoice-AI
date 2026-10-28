import { z } from "zod";

import { ApiError, fromPostgres, readJson, route } from "@/server/http";
import { requireOwner } from "@/server/owner";
import { slugFor } from "@/server/shops";

const Body = z.object({ name: z.string().trim().min(1).max(80).default("My shop") }).strict();

// Creates the signed-in owner's shop before voice setup fills it in. RLS
// allows one shop per owner and none for anonymous demo users (E-29).
export const POST = route(async (request) => {
  const { db, user } = await requireOwner();
  const { name } = await readJson(request, Body);
  const { data, error } = await db
    .from("shops")
    .insert({ owner_id: user.id, name, slug: slugFor(name) })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new ApiError(409, "SHOP_EXISTS", "You already have a shop");
    throw fromPostgres(error);
  }
  return Response.json({ shop: data }, { status: 201 });
});
