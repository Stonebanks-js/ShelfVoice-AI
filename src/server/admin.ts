import "server-only";

import { env } from "@/env/server";
import type { Database } from "@/types/database";

import { ApiError } from "./http";
import { log } from "./log";
import { adminClient, ownerClient } from "./supabase";

type Job = Database["public"]["Enums"]["ai_job"];

export interface AdminToday {
  spentTotalUsd: number;
  spentTodayUsd: number;
  budgetUsd: number;
  dailyBudgetUsd: number;
  jobs: Array<{ job: Job; calls: number; ok: number; p95Ms: number | null; costUsd: number }>;
  confirmed: number;
  confirmedUnedited: number;
  shops: number;
  shopsToday: number;
  products: number;
  reviews: number;
  reviewsToday: number;
  demoSignInsToday: number;
  breaker: { state: Database["public"]["Enums"]["breaker_state"]; manual: boolean; failures: number; openedAt: string | null };
}

// The team's accounts (W-20b). Anonymous demo users have no email.
export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && env.ADMIN_EMAILS?.includes(email.trim().toLowerCase()));
}

// The signed-in admin, or a 404 for everyone else: the admin page and its API
// don't admit to existing.
export async function requireAdmin() {
  const { data } = await (await ownerClient()).auth.getUser();
  if (!data.user || !isAdminEmail(data.user.email)) throw new ApiError(404, "NOT_FOUND", "Not found");
  return data.user;
}

// Today's numbers in India time, read with the service role.
export async function adminToday(): Promise<AdminToday> {
  const db = adminClient();
  const [stats, breaker] = await Promise.all([
    db.rpc("admin_today"),
    db.from("ai_breaker").select("*").eq("provider", "meta").maybeSingle(),
  ]);
  if (stats.error || breaker.error) throw new ApiError(500, "DATABASE", "Something went wrong");
  const s = stats.data as Record<string, unknown> & { jobs: Array<Record<string, unknown>> };
  const n = (value: unknown) => Number(value ?? 0);
  return {
    spentTotalUsd: n(s.spent_total_usd),
    spentTodayUsd: n(s.spent_today_usd),
    budgetUsd: env.AI_TOTAL_BUDGET_USD,
    dailyBudgetUsd: env.AI_DAILY_BUDGET_USD,
    jobs: s.jobs.map((j) => ({
      job: j.job as Job,
      calls: n(j.calls),
      ok: n(j.ok),
      p95Ms: j.p95_ms == null ? null : n(j.p95_ms),
      costUsd: n(j.cost_usd),
    })),
    confirmed: n(s.confirmed),
    confirmedUnedited: n(s.confirmed_unedited),
    shops: n(s.shops),
    shopsToday: n(s.shops_today),
    products: n(s.products),
    reviews: n(s.reviews),
    reviewsToday: n(s.reviews_today),
    demoSignInsToday: n(s.demo_sign_ins_today),
    breaker: {
      state: breaker.data?.state ?? "CLOSED",
      manual: breaker.data?.manual ?? false,
      failures: breaker.data?.failures ?? 0,
      openedAt: breaker.data?.opened_at ?? null,
    },
  };
}

// The manual switch (W-20b): open pauses every Meta call until switched
// back; closing also clears any automatic open.
export async function setBreaker(open: boolean, userId: string) {
  const { error } = await adminClient()
    .from("ai_breaker")
    .upsert({ provider: "meta", state: open ? "OPEN" : "CLOSED", manual: open, failures: 0, opened_at: open ? new Date().toISOString() : null });
  if (error) throw new ApiError(500, "DATABASE", "Something went wrong");
  log("warn", open ? "ai.breaker.manual_open" : "ai.breaker.manual_close", { provider: "meta", userId });
}
