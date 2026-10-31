import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createMetaClient, type AiLedger, type BreakerState, type CallRecord, type Transport, type TransportResponse } from "./meta";
import { recordedTransport, recordingKey } from "./transport";

function memoryLedger(spend = { totalUsd: 0, todayUsd: 0, shopTodayUsd: 0 }, breaker?: BreakerState) {
  const calls: CallRecord[] = [];
  let state: BreakerState = breaker ?? { state: "CLOSED", failures: 0, openedAt: null };
  const ledger: AiLedger = {
    spend: async () => spend,
    breaker: async () => state,
    saveBreaker: async (_p, s) => {
      state = s;
    },
    record: async (c) => {
      calls.push(c);
    },
  };
  return { ledger, calls, breakerState: () => state };
}

function scripted(...responses: Array<TransportResponse | Error>) {
  const requests: Array<Parameters<Transport>> = [];
  const transport: Transport = async (...args) => {
    requests.push(args);
    const next = responses.shift();
    if (!next) throw new Error("no scripted response left");
    if (next instanceof Error) throw next;
    return next;
  };
  return { transport, requests };
}

const sparkReply = (json: unknown, usage = { input_tokens: 1000, output_tokens: 200, input_tokens_details: { cached_tokens: 0 } }) => ({
  status: 200,
  body: { output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(json) }] }], usage },
});

const schema = {
  name: "thing",
  json: { type: "object" },
  zod: z.object({ name: z.string(), price: z.number().nullable() }).strict(),
};
const budget = { totalUsd: 100, dailyUsd: 15, shopDailyUsd: 2 };
const ctx = { job: "SETUP_EXTRACTION" as const, shopId: "shop-1" };
const noSleep = async () => {};

describe("Meta client: structured output", () => {
  it("returns Zod-checked data and logs one OK call with its cost", async () => {
    const { transport, requests } = scripted(sparkReply({ name: "Maggi", price: 14 }));
    const { ledger, calls } = memoryLedger();
    const client = createMetaClient({ transport, ledger, budget, sleep: noSleep });

    const result = await client.structured(ctx, { instructions: "x", input: "y", schema });

    expect(result).toEqual({ name: "Maggi", price: 14 });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ outcome: "OK", retries: 0, inputTokens: 1000, outputTokens: 200, model: "muse-spark-1.3" });
    expect(calls[0].costUsd).toBeCloseTo(1000 * 1.25e-6 + 200 * 4.25e-6, 9);
    const body = requests[0][1].json as { reasoning: { effort: string }; text: { format: { strict: boolean } } };
    expect(body.reasoning.effort).toBe("low");
    expect(body.text.format.strict).toBe(true);
  });

  it("charges cached input tokens at the cached rate", async () => {
    const usage = { input_tokens: 1000, output_tokens: 0, input_tokens_details: { cached_tokens: 800 } };
    const { transport } = scripted(sparkReply({ name: "a", price: null }, usage));
    const { ledger, calls } = memoryLedger();
    await createMetaClient({ transport, ledger, budget }).structured(ctx, { instructions: "x", input: "y", schema });
    expect(calls[0].costUsd).toBeCloseTo(200 * 1.25e-6 + 800 * 0.15e-6, 9);
  });

  it("rejects output that doesn't match the schema, without retrying", async () => {
    const { transport, requests } = scripted(sparkReply({ name: "Maggi", price: "fourteen" }));
    const { ledger, calls, breakerState } = memoryLedger();
    const client = createMetaClient({ transport, ledger, budget, sleep: noSleep });

    await expect(client.structured(ctx, { instructions: "x", input: "y", schema })).rejects.toMatchObject({ code: "AI_BAD_OUTPUT" });
    expect(requests).toHaveLength(1);
    expect(calls[0].outcome).toBe("SCHEMA_REJECTED");
    expect(breakerState().failures).toBe(0);
  });

  it("retries once after a 429 and succeeds", async () => {
    const { transport, requests } = scripted({ status: 429, body: {} }, sparkReply({ name: "a", price: 1 }));
    const { ledger, calls } = memoryLedger();
    const sleep = vi.fn(noSleep);
    const result = await createMetaClient({ transport, ledger, budget, sleep }).structured(ctx, { instructions: "x", input: "y", schema });
    expect(result.name).toBe("a");
    expect(requests).toHaveLength(2);
    expect(sleep).toHaveBeenCalledOnce();
    expect(calls[0]).toMatchObject({ outcome: "OK", retries: 1 });
  });

  it("gives up after two 5xx answers and counts one breaker failure", async () => {
    const { transport, requests } = scripted({ status: 503, body: {} }, { status: 502, body: {} });
    const { ledger, calls, breakerState } = memoryLedger();
    const client = createMetaClient({ transport, ledger, budget, sleep: noSleep });
    await expect(client.structured(ctx, { instructions: "x", input: "y", schema })).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
    expect(requests).toHaveLength(2);
    expect(calls[0]).toMatchObject({ outcome: "ERROR", retries: 1 });
    expect(breakerState()).toMatchObject({ state: "CLOSED", failures: 1 });
  });

  it("records a timeout as TIMEOUT", async () => {
    const timeout = () => new DOMException("timed out", "TimeoutError");
    const { transport } = scripted(timeout(), timeout());
    const { ledger, calls } = memoryLedger();
    await expect(
      createMetaClient({ transport, ledger, budget, sleep: noSleep }).structured(ctx, { instructions: "x", input: "y", schema }),
    ).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
    expect(calls[0].outcome).toBe("TIMEOUT");
  });

  it("does not retry a 401 (key revoked or region blocked)", async () => {
    const { transport, requests } = scripted({ status: 401, body: {} });
    const { ledger, calls } = memoryLedger();
    await expect(
      createMetaClient({ transport, ledger, budget, sleep: noSleep }).structured(ctx, { instructions: "x", input: "y", schema }),
    ).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
    expect(requests).toHaveLength(1);
    expect(calls[0].outcome).toBe("ERROR");
  });
});

describe("Meta client: budget caps (errata E-06)", () => {
  const run = (spend: { totalUsd: number; todayUsd: number; shopTodayUsd: number }) => {
    const { transport, requests } = scripted(sparkReply({ name: "a", price: 1 }));
    const { ledger } = memoryLedger(spend);
    return {
      requests,
      call: createMetaClient({ transport, ledger, budget }).structured(ctx, { instructions: "x", input: "y", schema }),
    };
  };

  it("pauses AI at 95% of the total budget without calling Meta", async () => {
    const { call, requests } = run({ totalUsd: 95, todayUsd: 0, shopTodayUsd: 0 });
    await expect(call).rejects.toMatchObject({ code: "AI_PAUSED" });
    expect(requests).toHaveLength(0);
  });

  it("pauses AI when today's global cap is reached", async () => {
    await expect(run({ totalUsd: 20, todayUsd: 15, shopTodayUsd: 0 }).call).rejects.toMatchObject({ code: "AI_PAUSED" });
  });

  it("pauses AI for one shop at its daily cap", async () => {
    await expect(run({ totalUsd: 20, todayUsd: 3, shopTodayUsd: 2 }).call).rejects.toMatchObject({ code: "AI_PAUSED" });
  });

  it("allows calls below every cap", async () => {
    await expect(run({ totalUsd: 94, todayUsd: 14, shopTodayUsd: 1.9 }).call).resolves.toEqual({ name: "a", price: 1 });
  });
});

describe("Meta client: circuit breaker (doc 05)", () => {
  const now = new Date("2026-11-05T10:00:00Z");

  it("refuses calls while open, without calling Meta", async () => {
    const { transport, requests } = scripted(sparkReply({ name: "a", price: 1 }));
    const { ledger } = memoryLedger(undefined, { state: "OPEN", failures: 5, openedAt: new Date(now.getTime() - 30_000) });
    const client = createMetaClient({ transport, ledger, budget, now: () => now });
    await expect(client.structured(ctx, { instructions: "x", input: "y", schema })).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
    expect(requests).toHaveLength(0);
  });

  it("stays shut while switched open from the admin page, however long ago", async () => {
    const { transport, requests } = scripted(sparkReply({ name: "a", price: 1 }));
    const { ledger } = memoryLedger(undefined, { state: "OPEN", failures: 0, openedAt: new Date(now.getTime() - 3_600_000), manual: true });
    const client = createMetaClient({ transport, ledger, budget, now: () => now });
    await expect(client.structured(ctx, { instructions: "x", input: "y", schema })).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
    expect(requests).toHaveLength(0);
  });

  it("lets one probe through after 60 s and closes on success", async () => {
    const { transport } = scripted(sparkReply({ name: "a", price: 1 }));
    const { ledger, breakerState } = memoryLedger(undefined, { state: "OPEN", failures: 5, openedAt: new Date(now.getTime() - 61_000) });
    await createMetaClient({ transport, ledger, budget, now: () => now }).structured(ctx, { instructions: "x", input: "y", schema });
    expect(breakerState()).toEqual({ state: "CLOSED", failures: 0, openedAt: null });
  });

  it("doesn't count Meta refusing one request (a 400) as an outage", async () => {
    const { transport } = scripted({ status: 400, body: {} });
    const { ledger, breakerState } = memoryLedger(undefined, { state: "CLOSED", failures: 4, openedAt: null });
    const client = createMetaClient({ transport, ledger, budget, sleep: noSleep, now: () => now });
    await expect(client.structured(ctx, { instructions: "x", input: "y", schema })).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
    expect(breakerState()).toEqual({ state: "CLOSED", failures: 0, openedAt: null });
  });

  it("opens after the fifth failure", async () => {
    const { transport } = scripted({ status: 500, body: {} }, { status: 500, body: {} });
    const { ledger, breakerState } = memoryLedger(undefined, { state: "CLOSED", failures: 4, openedAt: null });
    const client = createMetaClient({ transport, ledger, budget, sleep: noSleep, now: () => now });
    await expect(client.structured(ctx, { instructions: "x", input: "y", schema })).rejects.toBeTruthy();
    expect(breakerState()).toMatchObject({ state: "OPEN", failures: 5, openedAt: now });
  });
});

describe("Meta client: tools and transcription", () => {
  it("returns parsed tool calls", async () => {
    const { transport, requests } = scripted({
      status: 200,
      body: {
        output: [
          { type: "reasoning" },
          { type: "function_call", name: "update_price", arguments: '{"product_id":"p1","price_rupees":15}' },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
      },
    });
    const { ledger } = memoryLedger();
    const result = await createMetaClient({ transport, ledger, budget }).tools(
      { job: "COMMAND" },
      { instructions: "x", input: "y", tools: [{ name: "update_price", description: "d", parameters: {} }] },
    );
    expect(result.calls).toEqual([{ name: "update_price", arguments: { product_id: "p1", price_rupees: 15 } }]);
    const body = requests[0][1].json as { tools: Array<{ type: string; strict: boolean }>; tool_choice?: string };
    expect(body.tools[0]).toMatchObject({ type: "function", strict: true });
    // Meta supports only the default "auto" (errata E-30).
    expect(body.tool_choice).toBeUndefined();
  });

  it("sends the request and audio parts and charges by whole audio seconds", async () => {
    const { transport, requests } = scripted({
      status: 200,
      body: { sessionId: "s", transcript: "Maggi ka price 15 kar do", audioDurationMs: 2400, turns: [] },
    });
    const { ledger, calls } = memoryLedger();
    const result = await createMetaClient({ transport, ledger, budget }).transcribe(
      { job: "TRANSCRIBE" },
      { audio: new Uint8Array([1, 2, 3]), keywords: ["Maggi"] },
    );
    expect(result).toEqual({ transcript: "Maggi ka price 15 kar do", audioDurationMs: 2400 });
    const form = requests[0][1].form!;
    expect(form.has("request") && form.has("audio")).toBe(true);
    const sent = JSON.parse(await (form.get("request") as Blob).text());
    expect(sent).toMatchObject({ model: "muse-voice-transcribe-1.0", audioEncoding: "WAV", keywords: ["Maggi"], languageBias: ["hi", "en"] });
    expect(calls[0]).toMatchObject({ audioSeconds: 3, outcome: "OK" });
    expect(calls[0].costUsd).toBeCloseTo(3 * (0.18 / 3600), 9);
  });
});

describe("recorded transport (doc 04, V3)", () => {
  it("replays a saved response and refuses an unrecorded request", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "meta-"));
    const payload = { model: "m", input: "hello" };
    writeFileSync(path.join(dir, `${recordingKey("/responses", payload)}.json`), JSON.stringify({ status: 200, body: { ok: 1 } }));
    const transport = recordedTransport(dir);
    await expect(transport("/responses", { json: payload, timeoutMs: 1 })).resolves.toEqual({ status: 200, body: { ok: 1 } });
    await expect(transport("/responses", { json: { ...payload, input: "other" }, timeoutMs: 1 })).rejects.toMatchObject({
      code: "AI_NOT_RECORDED",
    });
  });
});
