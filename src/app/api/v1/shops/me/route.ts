import { route } from "@/server/http";
import { requireOwner } from "@/server/owner";

// The signed-in owner and their shop (null until created).
export const GET = route(async () => {
  const { db, user } = await requireOwner();
  const { data: shop } = await db.from("shops").select("*").maybeSingle();
  return Response.json({ user: { id: user.id, isAnonymous: user.is_anonymous ?? false }, shop });
});
