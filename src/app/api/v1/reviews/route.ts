import { route } from "@/server/http";
import { requireShop } from "@/server/owner";
import { reviewFeed } from "@/server/reviews";

// Review feed (doc 06 O-8): transcript, sentiment, items, stock-out flag, and
// a short-lived link to play the audio while it exists (30 days, decision P1).
export const GET = route(async (request) => {
  const { db, shop } = await requireShop();
  const url = new URL(request.url);
  // Anything that isn't a whole number falls back to the default.
  const int = (name: string, fallback: number) => {
    const n = Number(url.searchParams.get(name) ?? fallback);
    return Number.isInteger(n) ? n : fallback;
  };
  const page = Math.max(1, int("page", 1));
  const pageSize = Math.min(50, Math.max(1, int("pageSize", 20)));
  return Response.json({ reviews: await reviewFeed(db, shop.id, page, pageSize), page, pageSize });
});
