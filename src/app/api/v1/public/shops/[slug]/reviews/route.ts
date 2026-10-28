import { after } from "next/server";
import { z } from "zod";

import { ipHash, limit, verifyTurnstile } from "@/server/abuse";
import { ApiError, route } from "@/server/http";
import { analyseStoredReview, storeReview } from "@/server/reviews";
import { adminClient } from "@/server/supabase";

const Fields = z.object({
  reviewId: z.uuid(),
  consent: z.literal("true"),
  turnstileToken: z.string().min(1).max(4096),
});

// Customer voice review (doc 01 FR-08, doc 03): no sign-in, Turnstile, rate
// limits, consent, a WAV check, then a thank-you while analysis runs after
// the response (doc 02 background jobs).
export const POST = route(async (request, ctx: RouteContext<"/api/v1/public/shops/[slug]/reviews">, { requestId }) => {
  const { slug } = await ctx.params;
  const { data: shop } = await adminClient().from("shops").select("id, is_published").eq("slug", slug).maybeSingle();
  if (!shop?.is_published) throw new ApiError(404, "NOT_FOUND", "This shop isn't online right now");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError(400, "BAD_FORM", "Send the review as a form");
  }
  const fields = Fields.parse(Object.fromEntries(["reviewId", "consent", "turnstileToken"].map((k) => [k, form.get(k)])));
  const audio = form.get("audio");
  if (!(audio instanceof Blob)) throw new ApiError(422, "AUDIO_REQUIRED", "The recording is missing");

  // Turnstile before the limits, so bots can't use up a shop's daily quota.
  await verifyTurnstile(fields.turnstileToken, request);
  const ip = ipHash(request);
  await limit(`review:${shop.id}:${ip}`, 3, 3600);
  await limit(`review:${shop.id}`, 200, 86_400);

  const created = await storeReview(shop.id, {
    reviewId: fields.reviewId,
    consent: true,
    audio: new Uint8Array(await audio.arrayBuffer()),
    ipHash: ip,
  });
  if (created) after(() => analyseStoredReview(fields.reviewId, requestId));
  return Response.json({ reviewId: fields.reviewId }, { status: created ? 201 : 200 });
});
