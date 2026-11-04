import "server-only";

import { createHash } from "node:crypto";

import { env } from "@/env/server";

import { ApiError } from "./http";
import { log } from "./log";
import { adminClient } from "./supabase";

// Client IP, hashed with a salt that rotates daily:
// enough to rate-limit, never stored raw.
export function ipHash(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${env.CRON_SECRET ?? "local-salt"}:${day}:${ip}`).digest("hex").slice(0, 32);
}

// Fixed-window limit. Throws 429 once the window is full.
export async function limit(key: string, max: number, windowSeconds: number) {
  const { data, error } = await adminClient().rpc("hit_rate_limit", { p_key: key, p_window_seconds: windowSeconds });
  if (error) throw new ApiError(500, "DATABASE", "Something went wrong");
  if (data > max) throw new ApiError(429, "RATE_LIMITED", "Too many requests, please try again later");
}

// Cloudflare Turnstile server-side check.
export async function verifyTurnstile(token: string | null | undefined, request: Request): Promise<void> {
  if (!token) throw new ApiError(403, "TURNSTILE_REQUIRED", "Please complete the check and try again");
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) body.set("remoteip", ip);
  let answer: Siteverify = { success: false, "error-codes": ["unreachable"] };
  try {
    answer = await siteverify(body);
  } catch {
    // Turnstile failure rejects with a friendly retry message.
  }
  if (answer.success) return;
  // Cloudflare's reason, never the token or the secret:
  // "invalid-input-secret" means our setup is wrong, "invalid-input-response"
  // a bad or foreign token, "timeout-or-duplicate" a reused one.
  log("warn", "turnstile.failed", { codes: answer["error-codes"] ?? [], hostname: answer.hostname ?? null });
  throw new ApiError(403, "TURNSTILE_FAILED", "Couldn't verify, please try again");
}

type Siteverify = { success?: boolean; "error-codes"?: string[]; hostname?: string };

async function siteverify(body: URLSearchParams): Promise<Siteverify> {
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
    signal: AbortSignal.timeout(5000),
  });
  return (await res.json()) as Siteverify;
}

// Whether Cloudflare accepts our secret at all, from a check with a
// token that can't be valid: a good secret gets "invalid-input-response", a
// wrong one "invalid-input-secret". Cached 5 minutes; reveals no key.
let secretCheck: { status: "accepted" | "rejected" | "unreachable"; at: number } | undefined;
export async function turnstileSecretStatus(): Promise<"accepted" | "rejected" | "unreachable"> {
  if (secretCheck && Date.now() - secretCheck.at < 300_000) return secretCheck.status;
  let status: "accepted" | "rejected" | "unreachable" = "unreachable";
  try {
    const codes = (await siteverify(new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: "health-check" })))["error-codes"] ?? [];
    status = codes.includes("invalid-input-secret") || codes.includes("missing-input-secret") ? "rejected" : "accepted";
  } catch {
    // Cloudflare unreachable: say so, try again next time.
  }
  secretCheck = { status, at: Date.now() };
  return status;
}
