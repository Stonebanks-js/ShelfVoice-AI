import "server-only";

import { meta } from "@/server/ai";
import { analyseReview } from "@/server/ai/jobs";
import { AiError } from "@/server/ai/meta";
import { AUDIO_LIMITS, checkWav } from "@/server/audio";
import { refreshForecasts } from "@/server/forecast/refresh";
import { ApiError } from "@/server/http";
import { log } from "@/server/log";
import { adminClient } from "@/server/supabase";

export interface ReviewSubmission {
  reviewId: string;
  consent: boolean;
  audio: Uint8Array;
  ipHash: string;
}

// Stores a customer's voice review (doc 01 FR-08). Customers never sign in,
// so the server writes with the service role after its own checks.
// Returns false when this review ID was already submitted (a retry).
export async function storeReview(shopId: string, review: ReviewSubmission): Promise<boolean> {
  if (!review.consent) throw new ApiError(422, "CONSENT_REQUIRED", "Please agree before recording");
  const wav = checkWav(review.audio, AUDIO_LIMITS.review);
  if (!wav.ok) throw new ApiError(422, "BAD_AUDIO", `The recording ${wav.reason}`);

  const db = adminClient();
  const { data: prior } = await db.from("reviews").select("id").eq("id", review.reviewId).maybeSingle();
  if (prior) return false;

  const audioPath = `${shopId}/reviews/${review.reviewId}.wav`;
  const { error: uploadError } = await db.storage
    .from("voice")
    .upload(audioPath, Buffer.from(review.audio), { contentType: "audio/wav", upsert: true });
  if (uploadError) throw new ApiError(500, "STORAGE", "Couldn't send. Tap to try again.");

  const { error } = await db.from("reviews").insert({
    id: review.reviewId,
    shop_id: shopId,
    audio_path: audioPath,
    consent_at: new Date().toISOString(),
    ip_hash: review.ipHash,
  });
  if (error) {
    if (error.code === "23505") return false;
    throw new ApiError(500, "DATABASE", "Couldn't send. Tap to try again.");
  }
  return true;
}

// Transcribe and analyse a stored review (doc 01 FR-09). On an AI failure the
// review stays PENDING for the nightly retry (doc 02 background jobs).
export async function analyseStoredReview(reviewId: string, requestId?: string): Promise<"ANALYZED" | "PENDING" | "FAILED"> {
  const db = adminClient();
  const { data: review } = await db.from("reviews").select("*").eq("id", reviewId).maybeSingle();
  if (!review || review.status !== "PENDING") return review?.status ?? "FAILED";
  if (!review.audio_path || review.audio_deleted_at) {
    await db.from("reviews").update({ status: "FAILED" }).eq("id", reviewId);
    return "FAILED";
  }

  const ctx = { job: "TRANSCRIBE" as const, shopId: review.shop_id, reviewId, requestId };
  try {
    const { data: file, error } = await db.storage.from("voice").download(review.audio_path);
    if (error || !file) throw error ?? new Error("audio missing");
    const audio = new Uint8Array(await file.arrayBuffer());
    const { data: catalog } = await db
      .from("products")
      .select("id, name, aliases, price_paise, stock_qty")
      .eq("shop_id", review.shop_id)
      .is("archived_at", null);

    const ai = meta();
    const keywords = [...new Set((catalog ?? []).flatMap((p) => [p.name, ...p.aliases]))];
    const { transcript } = await ai.transcribe(ctx, { audio, keywords });
    if (!transcript.trim()) {
      await db.from("reviews").update({ status: "ANALYZED", transcript: "", summary: "No speech heard." }).eq("id", reviewId);
      return "ANALYZED";
    }

    const insight = await analyseReview(ai, ctx, transcript, catalog ?? []);
    await db
      .from("reviews")
      .update({
        status: "ANALYZED",
        transcript: transcript.slice(0, 1000),
        sentiment: insight.sentiment,
        summary: insight.summary.slice(0, 200),
        mentioned_product_ids: insight.mentioned_product_ids,
        stockout_product_ids: insight.stockout_product_ids,
      })
      .eq("id", reviewId);

    // Stock-out mentions raise the item on the order list (doc 01 story 4).
    if (insight.stockout_product_ids.length) await refreshForecasts(review.shop_id, insight.stockout_product_ids);
    return "ANALYZED";
  } catch (error) {
    log(error instanceof AiError ? "warn" : "error", "review.analysis_failed", { requestId, reviewId, error });
    return "PENDING";
  }
}
