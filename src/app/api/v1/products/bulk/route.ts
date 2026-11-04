import { z } from "zod";

import { limit } from "@/server/abuse";
import { addProducts, MAX_BULK, ProductInput } from "@/server/catalog";
import { readJson, route } from "@/server/http";
import { requireShop } from "@/server/owner";

const Body = z.object({ products: z.array(ProductInput).min(1).max(MAX_BULK) }).strict();

// Many products at once, from a ready-made list or a spreadsheet.
// Products the shop already has are skipped, not doubled.
export const POST = route(async (request, _ctx, { requestId }) => {
  const owner = await requireShop();
  await limit(`products-bulk:${owner.user.id}`, 20, 60);
  const { products } = await readJson(request, Body);
  const { added, skipped } = await addProducts({ ...owner, requestId }, products);
  return Response.json({ added: added.length, skipped }, { status: 201 });
});
