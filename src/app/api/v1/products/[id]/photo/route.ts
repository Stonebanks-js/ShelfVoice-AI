import { z } from "zod";

import { limit } from "@/server/abuse";
import { readJson, route } from "@/server/http";
import { requireShop } from "@/server/owner";
import { choosePhoto, photoCandidates, removePhoto } from "@/server/product-photos";

// A product's photo (V-11): the candidates to choose from, the owner's
// choice, or none. Only the shop's own products; 30 searches a minute.
export const GET = route(async (_request, ctx: RouteContext<"/api/v1/products/[id]/photo">) => {
  const { id } = await ctx.params;
  const owner = await requireShop();
  await limit(`photos:${owner.shop.id}`, 30, 60);
  return Response.json(await photoCandidates(owner, id));
});

const Choice = z.object({ code: z.string().regex(/^[0-9]{6,14}$/) }).strict();

export const PUT = route(async (request, ctx: RouteContext<"/api/v1/products/[id]/photo">) => {
  const { id } = await ctx.params;
  const owner = await requireShop();
  await limit(`photos:${owner.shop.id}`, 30, 60);
  const { code } = await readJson(request, Choice);
  return Response.json(await choosePhoto(owner, id, code));
});

export const DELETE = route(async (_request, ctx: RouteContext<"/api/v1/products/[id]/photo">) => {
  const { id } = await ctx.params;
  await removePhoto(await requireShop(), id);
  return new Response(null, { status: 204 });
});
