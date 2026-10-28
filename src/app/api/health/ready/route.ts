import { env } from "@/env/server";
import { log } from "@/server/log";
import { adminClient } from "@/server/supabase";

// Readiness (doc 05): Postgres under 500 ms, Storage reachable, Meta key
// valid (cached 5 minutes, no token spend), AI budget below 95%. Returns 503
// naming the failed check. Also keeps the free Supabase project from pausing.
let metaCheck: { ok: boolean; at: number } | undefined;

async function metaKeyValid(): Promise<boolean> {
  if (env.META_MODE !== "live") return true;
  if (metaCheck && Date.now() - metaCheck.at < 300_000) return metaCheck.ok;
  try {
    const res = await fetch(`${env.META_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${env.META_API_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    metaCheck = { ok: res.ok, at: Date.now() };
  } catch {
    metaCheck = { ok: false, at: Date.now() };
  }
  return metaCheck.ok;
}

export async function GET() {
  const db = adminClient();
  const checks: Record<string, boolean> = {};

  const started = performance.now();
  const { error: dbError } = await db.from("shops").select("id").limit(1);
  checks.database = !dbError && performance.now() - started < 500;

  const { error: storageError } = await db.storage.getBucket("voice");
  checks.storage = !storageError;

  checks.meta = await metaKeyValid();

  const { data: spend } = await db.rpc("ai_spend", {}).single();
  checks.budget = spend ? Number(spend.total_usd) < env.AI_TOTAL_BUDGET_USD * 0.95 : false;

  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) log("warn", "health.not_ready", { failed });
  return Response.json(
    { status: failed.length ? "not_ready" : "ready", release: process.env.RELEASE ?? "dev", checks },
    { status: failed.length ? 503 : 200 },
  );
}
