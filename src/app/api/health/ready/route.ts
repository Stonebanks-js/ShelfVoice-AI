import { env } from "@/env/server";
import { log, release } from "@/server/log";
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

  // Best of two reads: a cold function's TLS handshake, or one slow hop to
  // the database region (staging is in Seoul, E-28), isn't database slowness.
  const timedRead = async () => {
    const started = performance.now();
    const { error } = await db.from("shops").select("id").limit(1);
    return { error, ms: Math.round(performance.now() - started) };
  };
  const reads = [await timedRead(), await timedRead()];
  const databaseMs = Math.min(...reads.map((r) => r.ms));
  // 1500 ms while the app reads Seoul staging; back to doc 05's 500 ms once
  // production is in Mumbai (E-31 item 9).
  checks.database = reads.every((r) => !r.error) && databaseMs < 1500;

  const { error: storageError } = await db.storage.getBucket("voice");
  checks.storage = !storageError;

  checks.meta = await metaKeyValid();

  const { data: spend } = await db.rpc("ai_spend", {}).single();
  checks.budget = spend ? Number(spend.total_usd) < env.AI_TOTAL_BUDGET_USD * 0.95 : false;

  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) log("warn", "health.not_ready", { failed, databaseMs });
  return Response.json(
    { status: failed.length ? "not_ready" : "ready", release: release(), checks, databaseMs },
    { status: failed.length ? 503 : 200 },
  );
}
