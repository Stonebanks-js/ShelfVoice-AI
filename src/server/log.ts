import { after } from "next/server";

// Structured JSON logs (doc 05 "Logging"): one object per line, event names
// as area.action, and a redaction pass so no audio, transcript, prompt,
// token, cookie, key, email or raw IP is ever written. Deployed, lines also
// go to Axiom and error events to the team's Discord channel (doc 05 O1, O4).
type Level = "debug" | "info" | "warn" | "error";
export type Severity = "critical" | "high" | "medium";

const REDACTED_KEYS = /^(key|apikey|api_key|token|access_token|refresh_token|authorization|cookie|password|secret|transcript|audio|prompt|instructions|email|ip)$/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, REDACTED_KEYS.test(k) ? "[redacted]" : redact(v, depth + 1)]),
  );
}

// Doc 05: each deploy is tagged with its git SHA so errors tie to a release.
// NEXT_PUBLIC_RELEASE is fixed at build time (next.config), which covers
// deploys from release.yml, where Vercel sets no git variables at runtime.
export const release = () =>
  process.env.RELEASE || process.env.NEXT_PUBLIC_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev";

// Work that must finish without delaying the response: after() inside a
// request (Vercel keeps the function alive for it), else once the current
// synchronous work is done, so lines logged together still ship together.
export function background(task: () => Promise<unknown>) {
  const run = () => task().catch(() => undefined);
  try {
    after(run);
  } catch {
    queueMicrotask(() => void run());
  }
}

export function log(level: Level, event: string, fields: Record<string, unknown> = {}) {
  if (level === "debug" && process.env.NODE_ENV === "production") return;
  const safe = redact(fields) as Record<string, unknown>;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, release: release(), ...safe });
  if (level === "error") console.error(line);
  else console.log(line);
  toAxiom(line);
  if (level === "error") alert("high", event, safe);
}

// ------------------------------------------------------------------- Axiom
let queued: string[] = [];
let flushScheduled = false;

function toAxiom(line: string) {
  if (!process.env.AXIOM_TOKEN || !process.env.AXIOM_DATASET) return;
  queued.push(line);
  if (flushScheduled) return;
  flushScheduled = true;
  background(flushLogs);
}

// Sends every queued line in one request. Failures go to the platform log
// only, never back through log(), so a broken sink can't loop.
export async function flushLogs() {
  flushScheduled = false;
  const token = process.env.AXIOM_TOKEN;
  const dataset = process.env.AXIOM_DATASET;
  if (!queued.length || !token || !dataset) return;
  const lines = queued;
  queued = [];
  try {
    const res = await fetch(`https://api.axiom.co/v1/datasets/${encodeURIComponent(dataset)}/ingest?timestamp-field=ts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-ndjson" },
      body: lines.join("\n"),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error(JSON.stringify({ level: "error", event: "log.ship_failed", status: res.status, lines: lines.length }));
  } catch (error) {
    console.error(JSON.stringify({ level: "error", event: "log.ship_failed", error: String(error), lines: lines.length }));
  }
}

// ----------------------------------------------------------------- Discord
const ALERT_QUIET_MS = 10 * 60_000; // one message per event per instance
const lastAlert = new Map<string, number>();

export function alert(severity: Severity, event: string, fields: Record<string, unknown> = {}) {
  background(() => sendAlert(severity, event, fields));
}

export async function sendAlert(severity: Severity, event: string, fields: Record<string, unknown> = {}) {
  const url = process.env.DISCORD_ALERT_WEBHOOK_URL;
  if (!url) return;
  const now = Date.now();
  if (now - (lastAlert.get(event) ?? -Infinity) < ALERT_QUIET_MS) return;
  lastAlert.set(event, now);
  const details = JSON.stringify(redact(fields)).slice(0, 1500);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `**${severity.toUpperCase()}** \`${event}\` · release ${release()}\n\`\`\`json\n${details}\n\`\`\``,
        allowed_mentions: { parse: [] },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error(JSON.stringify({ level: "error", event: "alert.send_failed", status: res.status }));
  } catch (error) {
    console.error(JSON.stringify({ level: "error", event: "alert.send_failed", error: String(error) }));
  }
}

// Tests only: forget throttling and queued lines between cases.
export function resetLogSinks() {
  queued = [];
  flushScheduled = false;
  lastAlert.clear();
}
