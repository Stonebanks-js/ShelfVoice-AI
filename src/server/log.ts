// Structured JSON logs (doc 05 "Logging"): one object per line, event names
// as area.action, and a redaction pass so no audio, transcript, prompt,
// token, cookie, key, email or raw IP is ever written.
type Level = "debug" | "info" | "warn" | "error";

const REDACTED_KEYS = /^(key|apikey|api_key|token|access_token|refresh_token|authorization|cookie|password|secret|transcript|audio|prompt|instructions|email|ip)$/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, REDACTED_KEYS.test(k) ? "[redacted]" : redact(v, depth + 1)]),
  );
}

export function log(level: Level, event: string, fields: Record<string, unknown> = {}) {
  if (level === "debug" && process.env.NODE_ENV === "production") return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    release: process.env.RELEASE ?? "dev",
    ...(redact(fields) as Record<string, unknown>),
  });
  if (level === "error") console.error(line);
  else console.log(line);
}
