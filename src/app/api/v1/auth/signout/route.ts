import { route } from "@/server/http";
import { ownerClient } from "@/server/supabase";

export const POST = route(async () => {
  const db = await ownerClient();
  await db.auth.signOut();
  return new Response(null, { status: 204 });
});
