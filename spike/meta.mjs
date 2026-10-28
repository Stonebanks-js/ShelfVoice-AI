// Shared helpers for the day-1 spike (doc 09, S0 to S5). Reads the Meta key
// from .env.local, calls the Meta Model API, and saves each request and
// response under spike/evidence/ with the key removed.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function loadEnvLocal() {
  const text = readFileSync(path.join(root, ".env.local"), "utf8").replace(/^﻿/, "");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) env[match[1]] = match[2].trim().replace(/^"(.*)"$/, "$1");
  }
  return env;
}

const env = loadEnvLocal();
export const META_API_KEY = env.META_API_KEY;
export const META_BASE_URL = (env.META_BASE_URL || "https://api.meta.ai/v1").replace(/\/$/, "");
if (!META_API_KEY) throw new Error("META_API_KEY is missing from .env.local");

const evidenceDir = path.join(import.meta.dirname, "evidence");
mkdirSync(evidenceDir, { recursive: true });

const redact = (value) => JSON.parse(JSON.stringify(value ?? null).split(META_API_KEY).join("<META_API_KEY>"));

export function saveEvidence(name, record) {
  const file = path.join(evidenceDir, `${name}.json`);
  writeFileSync(file, `${JSON.stringify(redact({ savedAt: new Date().toISOString(), ...record }), null, 2)}\n`);
  return path.relative(root, file);
}

// One HTTP call with timing; returns status, headers worth keeping, and body.
export async function call(method, endpoint, { json, form, timeoutMs = 30_000 } = {}) {
  const url = `${META_BASE_URL}${endpoint}`;
  const headers = { Authorization: `Bearer ${META_API_KEY}` };
  let body;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }
  const started = performance.now();
  const response = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) });
  const latencyMs = Math.round(performance.now() - started);
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  const keep = ["content-type", "x-request-id", "request-id", "x-ratelimit-limit-requests", "x-ratelimit-remaining-requests", "x-ratelimit-limit-tokens", "x-ratelimit-remaining-tokens", "retry-after"];
  const kept = Object.fromEntries(keep.filter((h) => response.headers.has(h)).map((h) => [h, response.headers.get(h)]));
  return { request: { method, url, json }, status: response.status, latencyMs, headers: kept, body: parsed };
}
