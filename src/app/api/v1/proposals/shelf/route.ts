import { z } from "zod";

import { limit } from "@/server/abuse";
import { readJson, route } from "@/server/http";
import { requireShop } from "@/server/owner";
import { photoProposal } from "@/server/proposals";

const Body = z.object({ path: z.string().min(1).max(200) }).strict();

// Shelf photo -> proposed new products (V-01, E-36).
export const POST = route(async (request, _ctx, { requestId }) => {
  const owner = await requireShop();
  await limit(`proposals:${owner.user.id}`, 30, 60);
  const { path } = await readJson(request, Body);
  return Response.json(await photoProposal({ ...owner, requestId }, path, "shelf"), { status: 201 });
});
