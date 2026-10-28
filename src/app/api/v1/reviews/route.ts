import { fromPostgres, route } from "@/server/http";
import { requireShop } from "@/server/owner";

const AUDIO_URL_SECONDS = 3600;

// Review feed (doc 06 O-8): transcript, sentiment, items, stock-out flag, and
// a short-lived link to play the audio while it exists (30 days, decision P1).
export const GET = route(async (request) => {
  const { db, shop } = await requireShop();
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20)));
  const { data, error } = await db
    .from("reviews")
    .select("id, status, transcript, sentiment, summary, mentioned_product_ids, stockout_product_ids, is_hidden, audio_path, audio_deleted_at, created_at")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw fromPostgres(error);

  const reviews = await Promise.all(
    data.map(async ({ audio_path, audio_deleted_at, ...review }) => {
      if (!audio_path || audio_deleted_at) return { ...review, audioUrl: null };
      const { data: signed } = await db.storage.from("voice").createSignedUrl(audio_path, AUDIO_URL_SECONDS);
      return { ...review, audioUrl: signed?.signedUrl ?? null };
    }),
  );
  return Response.json({ reviews, page, pageSize });
});
