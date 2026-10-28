import "server-only";

import { createHash } from "node:crypto";

import { env } from "@/env/server";

import { ApiError } from "./http";
import { adminClient } from "./supabase";

// Client IP, hashed with a salt that rotates daily (doc 03 data inventory):
// enough to rate-limit, never stored raw.
export function ipHash(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${env.CRON_SECRET ?? "local-salt"}:${day}:${ip}`).digest("hex").slice(0, 32);
}

// Fixed-window limit (decision P4). Throws 429 once the window is full.
export async function limit(key: string, max: number, windowSeconds: number) {
  const { data, error } = await adminClient().rpc("hit_rate_limit", { p_key: key, p_window_seconds: windowSeconds });
  if (error) throw new ApiError(500, "DATABASE", "Something went wrong");
  if (data > max) throw new ApiError(429, "RATE_LIMITED", "Too many requests, please try again later");
}

// Cloudflare Turnstile server-side check (doc 03 P2, doc 07).
export async function verifyTurnstile(token: string | null | undefined, request: Request): Promise<void> {
  if (!token) throw new ApiError(403, "TURNSTILE_REQUIRED", "Please complete the check and try again");
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) body.set("remoteip", ip);
  let success = false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    success = ((await res.json()) as { success?: boolean }).success === true;
  } catch {
    // Doc 05: Turnstile failure rejects with a friendly retry message.
    success = false;
  }
  if (!success) throw new ApiError(403, "TURNSTILE_FAILED", "Couldn't verify, please try again");
}
