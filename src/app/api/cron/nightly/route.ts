import { timingSafeEqual } from "node:crypto";

import { env } from "@/env/server";
import { refreshForecasts } from "@/server/forecast/refresh";
import { log } from "@/server/log";
import { analyseStoredReview } from "@/server/reviews";
import { adminClient } from "@/server/supabase";

export const maxDuration = 300;

function authorised(request: Request): boolean {
  const expected = env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

// Nightly job (doc 02 "Background jobs"): refresh every shop's forecasts,
// retry reviews still waiting for analysis, and expire pending proposals
// older than 24 hours (doc 07). Vercel cron calls it with CRON_SECRET.
export async function GET(request: Request) {
  if (!authorised(request)) return Response.json({ error: { code: "UNAUTHORISED", message: "Not allowed" } }, { status: 401 });
  const db = adminClient();
  const started = Date.now();
  const result = { forecasts: 0, reviewsRetried: 0, reviewsAnalysed: 0, proposalsExpired: 0, failures: 0 };

  const { data: shops } = await db.from("shops").select("id");
  for (const shop of shops ?? []) {
    try {
      result.forecasts += await refreshForecasts(shop.id);
    } catch (error) {
      result.failures += 1;
      log("error", "cron.forecast_failed", { shopId: shop.id, error });
    }
  }

  const { data: pending } = await db
    .from("reviews")
    .select("id")
    .eq("status", "PENDING")
    .lt("created_at", new Date(Date.now() - 5 * 60_000).toISOString())
    .limit(100);
  for (const review of pending ?? []) {
    result.reviewsRetried += 1;
    if ((await analyseStoredReview(review.id)) === "ANALYZED") result.reviewsAnalysed += 1;
  }

  const { data: expired } = await db
    .from("proposals")
    .update({ status: "EXPIRED", decided_at: new Date().toISOString() })
    .eq("status", "PENDING")
    .lt("created_at", new Date(Date.now() - 86_400_000).toISOString())
    .select("id");
  result.proposalsExpired = expired?.length ?? 0;

  log(result.failures ? "warn" : "info", "cron.nightly.finished", { ...result, durationMs: Date.now() - started });
  return Response.json(result);
}
