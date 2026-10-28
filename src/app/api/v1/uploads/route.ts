import { z } from "zod";

import { readJson, route } from "@/server/http";
import { requireShop } from "@/server/owner";
import { signedUpload } from "@/server/proposals";

const Body = z.object({ kind: z.enum(["voice", "bill", "shelf"]), clientId: z.uuid() }).strict();

// Signed upload URL for an audio clip or photo (doc 02). The client
// generates clientId, so a retried upload reuses the same path (doc 07).
export const POST = route(async (request, _ctx, { requestId }) => {
  const owner = await requireShop();
  const { kind, clientId } = await readJson(request, Body);
  return Response.json(await signedUpload({ ...owner, requestId }, kind, clientId), { status: 201 });
});
