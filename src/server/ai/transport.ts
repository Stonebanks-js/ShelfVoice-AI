// HTTP transports for the Meta client. "live" calls the real API; "recorded"
// replays saved responses keyed by a hash of the request (doc 04, V3), so
// tests and CI are deterministic and free. With META_RECORD=1 in live mode,
// each live response is saved as a recording.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { AiError, type Transport } from "./meta";

export const FIXTURE_DIR = path.join(process.cwd(), "tests", "fixtures", "meta");

export function recordingKey(endpoint: string, payload: unknown): string {
  return createHash("sha256").update(`${endpoint}\n${JSON.stringify(payload)}`).digest("hex").slice(0, 32);
}

export function liveTransport(baseUrl: string, apiKey: string, record = false): Transport {
  return async (endpoint, init) => {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(init.json !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.json !== undefined ? JSON.stringify(init.json) : init.form,
      signal: AbortSignal.timeout(init.timeoutMs),
    });
    const text = await response.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    if (record && response.status === 200) {
      mkdirSync(FIXTURE_DIR, { recursive: true });
      const key = recordingKey(endpoint, init.json ?? init.formKey);
      writeFileSync(path.join(FIXTURE_DIR, `${key}.json`), `${JSON.stringify({ endpoint, status: response.status, body }, null, 2)}\n`);
    }
    return { status: response.status, body };
  };
}

export function recordedTransport(dir = FIXTURE_DIR): Transport {
  return async (endpoint, init) => {
    const key = recordingKey(endpoint, init.json ?? init.formKey);
    const file = path.join(dir, `${key}.json`);
    if (!existsSync(file)) {
      throw new AiError("AI_NOT_RECORDED", `No recorded Meta response ${key} for ${endpoint}; run with META_MODE=live META_RECORD=1`);
    }
    const saved = JSON.parse(readFileSync(file, "utf8")) as { status: number; body: unknown };
    return { status: saved.status, body: saved.body };
  };
}
