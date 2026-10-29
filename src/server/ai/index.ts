import "server-only";

import { env } from "@/env/server";
import { background, log, sendAlert } from "@/server/log";
import { adminClient } from "@/server/supabase";

import { createMetaClient, type AiLedger, type MetaClient } from "./meta";
import { liveTransport, recordedTransport } from "./transport";

// Ledger backed by ai_calls, ai_breaker and ai_spend(), via the service role.
export const ledger: AiLedger = {
  async spend(shopId) {
    const { data, error } = await adminClient().rpc("ai_spend", { p_shop_id: shopId ?? undefined }).single();
    if (error) throw error;
    return {
      totalUsd: Number(data.total_usd),
      todayUsd: Number(data.today_usd),
      shopTodayUsd: Number(data.shop_today_usd),
    };
  },
  async breaker(provider) {
    const { data, error } = await adminClient().from("ai_breaker").select("*").eq("provider", provider).maybeSingle();
    if (error) throw error;
    return {
      state: data?.state ?? "CLOSED",
      failures: data?.failures ?? 0,
      openedAt: data?.opened_at ? new Date(data.opened_at) : null,
    };
  },
  async saveBreaker(provider, state) {
    const { error } = await adminClient()
      .from("ai_breaker")
      .upsert({ provider, state: state.state, failures: state.failures, opened_at: state.openedAt?.toISOString() ?? null });
    if (error) throw error;
    if (state.state === "OPEN") log("error", "ai.breaker.open", { provider, failures: state.failures });
  },
  async record(call) {
    const { error } = await adminClient()
      .from("ai_calls")
      .insert({
        request_id: call.ctx.requestId ?? null,
        shop_id: call.ctx.shopId ?? null,
        proposal_id: call.ctx.proposalId ?? null,
        review_id: call.ctx.reviewId ?? null,
        job: call.ctx.job,
        model: call.model,
        prompt_version: call.ctx.promptVersion ?? null,
        input_tokens: call.inputTokens,
        cached_tokens: call.cachedTokens,
        output_tokens: call.outputTokens,
        audio_seconds: call.audioSeconds,
        cost_usd: Number(call.costUsd.toFixed(6)),
        latency_ms: call.latencyMs,
        retries: call.retries,
        outcome: call.outcome,
      });
    if (error) log("error", "ai.call.log_failed", { error });
    else if (call.costUsd > 0) background(() => budgetAlert(call.costUsd));
    const level = call.outcome === "OK" ? "info" : "warn";
    log(level, call.outcome === "OK" ? "ai.call.ok" : "ai.call.failed", {
      requestId: call.ctx.requestId,
      shopId: call.ctx.shopId,
      job: call.ctx.job,
      outcome: call.outcome,
      latencyMs: call.latencyMs,
      costUsd: call.costUsd,
    });
  },
};

// Doc 05 credit burn: alert at 50% and 80% of the total AI budget, and at
// 95%, where the client pauses AI features. Fires on the call that crosses.
const BUDGET_ALERTS = [
  { at: 0.95, severity: "critical" },
  { at: 0.8, severity: "medium" },
  { at: 0.5, severity: "medium" },
] as const;

export async function budgetAlert(costUsd: number) {
  const { totalUsd } = await ledger.spend(null);
  const capUsd = env.AI_TOTAL_BUDGET_USD;
  const crossed = BUDGET_ALERTS.find(({ at }) => totalUsd >= capUsd * at && totalUsd - costUsd < capUsd * at);
  if (!crossed) return;
  const event = `ai.budget.${crossed.at * 100}pct`;
  log("warn", event, { totalUsd, capUsd });
  await sendAlert(crossed.severity, event, { totalUsd: Number(totalUsd.toFixed(2)), capUsd });
}

let client: MetaClient | undefined;

export function meta(): MetaClient {
  if (!client) {
    if (env.META_MODE === "replay-demo") {
      // Decided after spike S0 (errata E-03); not built yet.
      throw new Error("META_MODE=replay-demo is not implemented yet (errata E-03)");
    }
    const transport =
      env.META_MODE === "live"
        ? liveTransport(env.META_BASE_URL, env.META_API_KEY!, process.env.META_RECORD === "1")
        : recordedTransport();
    client = createMetaClient({
      transport,
      ledger,
      budget: {
        totalUsd: env.AI_TOTAL_BUDGET_USD,
        dailyUsd: env.AI_DAILY_BUDGET_USD,
        shopDailyUsd: env.AI_SHOP_DAILY_BUDGET_USD,
      },
    });
  }
  return client;
}
