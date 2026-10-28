import { ipHash, limit } from "@/server/abuse";
import { createDemoCopy } from "@/server/demo/copy";
import { ApiError, route } from "@/server/http";
import { log } from "@/server/log";
import { ownerClient } from "@/server/supabase";

// "Try the demo shop" (doc 03): an anonymous sign-in that gets its own fresh
// copy of the seeded demo shop. 10 per IP per hour.
export const POST = route(async (request, _ctx, { requestId }) => {
  await limit(`demo:${ipHash(request)}`, 10, 3600);

  const db = await ownerClient();
  const { data, error } = await db.auth.signInAnonymously();
  if (error || !data.user) {
    log("error", "auth.demo.failed", { requestId, error: error?.message });
    throw new ApiError(503, "DEMO_UNAVAILABLE", "The demo shop isn't available right now");
  }

  const shopId = await createDemoCopy(data.user.id);
  log("info", "auth.demo.signed_in", { requestId, shopId });
  return Response.json({ shopId }, { status: 201 });
});
