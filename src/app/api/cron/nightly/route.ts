import { timingSafeEqual } from "node:crypto";

import { env } from "@/env/server";
import { runCleanup } from "@/server/cleanup";
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

// Nightly job (doc 02 "Background jobs"): the daily cleanup first (W-17b:
// expired proposals and demo shops, old recordings, photos and logs of AI
// calls), then every shop's forecasts and reviews still waiting for
// analysis. Vercel cron calls it with CRON_SECRET; running it daily also
// keeps the free Supabase project from pausing.
export async function GET(request: Request) {
  if (!authorised(request)) return Response.json({ error: { code: "UNAUTHORISED", message: "Not allowed" } }, { status: 401 });
  const db = adminClient();
  const started = Date.now();
  const cleanup = await runCleanup();
  const result = { forecasts: 0, reviewsRetried: 0, reviewsAnalysed: 0, failures: cleanup.failures };

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

  log(result.failures ? "warn" : "info", "cron.nightly.finished", { ...result, cleanup, durationMs: Date.now() - started });

  // Doc 05: Better Stack alerts if this ping is 2 hours late; /fail reports
  // a run that finished with errors.
  if (env.BETTERSTACK_HEARTBEAT_URL) {
    const url = result.failures ? `${env.BETTERSTACK_HEARTBEAT_URL.replace(/\/$/, "")}/fail` : env.BETTERSTACK_HEARTBEAT_URL;
    try {
      await fetch(url, { method: "POST", signal: AbortSignal.timeout(5000) });
    } catch (error) {
      log("warn", "cron.heartbeat_failed", { error });
    }
  }
  return Response.json({ ...result, cleanup });
}
