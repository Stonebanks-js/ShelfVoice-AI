import { z } from "zod";

import { limit } from "@/server/abuse";
import { readJson, route } from "@/server/http";
import { requireShop } from "@/server/owner";
import { voiceProposal } from "@/server/proposals";

const Body = z.object({ path: z.string().min(1).max(200), kind: z.enum(["SETUP", "COMMAND"]) }).strict();

// Owner voice note -> transcript -> proposed changes (doc 02 voice pipeline).
// Nothing is saved to the catalog until the owner confirms.
export const POST = route(async (request, _ctx, { requestId }) => {
  const owner = await requireShop();
  await limit(`proposals:${owner.user.id}`, 30, 60); // doc 03: 30 per owner per minute
  const { path, kind } = await readJson(request, Body);
  const result = await voiceProposal({ ...owner, requestId }, path, kind);
  return Response.json(result, { status: 201 });
});
