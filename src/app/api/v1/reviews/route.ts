import { route } from "@/server/http";
import { requireShop } from "@/server/owner";
import { reviewFeed } from "@/server/reviews";

// Review feed (doc 06 O-8): transcript, sentiment, items, stock-out flag, and
// a short-lived link to play the audio while it exists (30 days, decision P1).
export const GET = route(async (request) => {
  const { db, shop } = await requireShop();
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20)));
  return Response.json({ reviews: await reviewFeed(db, shop.id, page, pageSize), page, pageSize });
});
