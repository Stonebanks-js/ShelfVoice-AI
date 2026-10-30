// The only module that talks to the Meta Model API (doc 02 ADR-007, doc 07).
// Every call: budget caps (E-06) and circuit breaker checked first, a timeout,
// one retry on 429/5xx/timeout, one ai_calls row (doc 05), and outputs
// parsed again with Zod. Meta models only: muse-spark-1.3,
// muse-voice-transcribe-1.0 (and sam-3.1 for W-18).
import { createHash } from "node:crypto";
import { z } from "zod";

import type { Database } from "@/types/database";

export type AiJob = Database["public"]["Enums"]["ai_job"];
export type AiOutcome = Database["public"]["Enums"]["ai_outcome"];

export const MODELS = {
  spark: "muse-spark-1.3",
  transcribe: "muse-voice-transcribe-1.0",
} as const;

// Rate card (doc 07): USD per token, per audio second.
const RATES = {
  sparkIn: 1.25 / 1e6,
  sparkCachedIn: 0.15 / 1e6,
  sparkOut: 4.25 / 1e6,
  transcribePerSecond: 0.18 / 3600,
};

export interface AiContext {
  job: AiJob;
  shopId?: string | null;
  proposalId?: string | null;
  reviewId?: string | null;
  requestId?: string | null;
  promptVersion?: string;
}

export class AiError extends Error {
  constructor(
    readonly code: "AI_PAUSED" | "AI_UNAVAILABLE" | "AI_BAD_OUTPUT" | "AI_NOT_RECORDED",
    message: string,
  ) {
    super(message);
  }
}

// ------------------------------------------------------------- dependencies
export interface CallRecord {
  ctx: AiContext;
  model: string;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  audioSeconds: number;
  costUsd: number;
  latencyMs: number;
  retries: number;
  outcome: AiOutcome;
}

export interface BreakerState {
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  failures: number;
  openedAt: Date | null;
  // Opened from the admin page: stays open until switched back.
  manual?: boolean;
}

export interface AiLedger {
  spend(shopId: string | null | undefined): Promise<{ totalUsd: number; todayUsd: number; shopTodayUsd: number }>;
  breaker(provider: string): Promise<BreakerState>;
  saveBreaker(provider: string, state: BreakerState): Promise<void>;
  record(call: CallRecord): Promise<void>;
}

export interface Budget {
  totalUsd: number;
  dailyUsd: number;
  shopDailyUsd: number;
}

export interface TransportResponse {
  status: number;
  body: unknown;
}
export type Transport = (
  endpoint: string,
  init: { json?: unknown; form?: FormData; formKey?: unknown; timeoutMs: number },
) => Promise<TransportResponse>;

export interface MetaClientOptions {
  transport: Transport;
  ledger: AiLedger;
  budget: Budget;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}

// Doc 05 "Reliability patterns".
const TIMEOUT_MS = { spark: 30_000, transcribe: 20_000 };
const BREAKER = { failuresToOpen: 5, halfOpenAfterMs: 60_000 };
const PAUSE_AT_FRACTION = 0.95;

class RetryableError extends Error {
  constructor(readonly outcome: AiOutcome) {
    super(outcome);
  }
}

// ------------------------------------------------------------------- client
export type InputPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string };

export interface StructuredRequest<T> {
  instructions: string;
  input: string | InputPart[];
  schema: { name: string; json: Record<string, unknown>; zod: z.ZodType<T> };
  effort?: "low" | "medium" | "high";
  maxOutputTokens?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolRequest {
  instructions: string;
  input: string;
  tools: ToolDefinition[];
  effort?: "low" | "medium" | "high";
  maxOutputTokens?: number;
}

export interface ToolCall {
  name: string;
  arguments: unknown;
}

export function createMetaClient(options: MetaClientOptions) {
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const now = options.now ?? (() => new Date());

  async function guard(ctx: AiContext, provider: string) {
    const spend = await options.ledger.spend(ctx.shopId);
    const { budget } = options;
    if (
      spend.totalUsd >= budget.totalUsd * PAUSE_AT_FRACTION ||
      spend.todayUsd >= budget.dailyUsd ||
      (ctx.shopId && spend.shopTodayUsd >= budget.shopDailyUsd)
    ) {
      throw new AiError("AI_PAUSED", "AI features are paused: the spending cap was reached");
    }
    const breaker = await options.ledger.breaker(provider);
    if (breaker.manual) throw new AiError("AI_UNAVAILABLE", "The AI service is unavailable right now");
    if (breaker.state === "OPEN" && breaker.openedAt && now().getTime() - breaker.openedAt.getTime() < BREAKER.halfOpenAfterMs) {
      throw new AiError("AI_UNAVAILABLE", "The AI service is unavailable right now");
    }
    return breaker;
  }

  async function settleBreaker(provider: string, previous: BreakerState, ok: boolean) {
    if (ok) {
      if (previous.state !== "CLOSED" || previous.failures !== 0) {
        await options.ledger.saveBreaker(provider, { state: "CLOSED", failures: 0, openedAt: null });
      }
      return;
    }
    const failures = previous.failures + 1;
    const open = previous.state !== "CLOSED" || failures >= BREAKER.failuresToOpen;
    await options.ledger.saveBreaker(provider, {
      state: open ? "OPEN" : "CLOSED",
      failures,
      openedAt: open ? now() : previous.openedAt,
    });
  }

  // Sends one request with a single retry; returns the 2xx body or throws.
  async function send(
    ctx: AiContext,
    model: string,
    endpoint: string,
    init: { json?: unknown; form?: () => FormData; formKey?: unknown },
    timeoutMs: number,
    parse: (body: unknown) => { usage: Omit<CallRecord, "ctx" | "model" | "latencyMs" | "retries" | "outcome"> },
  ) {
    const provider = "meta";
    const breaker = await guard(ctx, provider);
    const started = performance.now();
    let retries = 0;
    let outcome: AiOutcome = "ERROR";
    let usage: Omit<CallRecord, "ctx" | "model" | "latencyMs" | "retries" | "outcome"> = {
      inputTokens: 0,
      cachedTokens: 0,
      outputTokens: 0,
      audioSeconds: 0,
      costUsd: 0,
    };

    try {
      for (let attempt = 0; ; attempt++) {
        try {
          const res = await options.transport(endpoint, {
            json: init.json,
            form: init.form?.(),
            formKey: init.formKey,
            timeoutMs,
          });
          if (res.status === 429) throw new RetryableError("RATE_LIMITED");
          if (res.status >= 500) throw new RetryableError("ERROR");
          if (res.status !== 200) {
            outcome = "ERROR";
            throw new AiError("AI_UNAVAILABLE", `Meta API returned ${res.status}`);
          }
          const parsed = parse(res.body);
          usage = parsed.usage;
          outcome = "OK";
          return res.body;
        } catch (error) {
          if (error instanceof RetryableError) {
            outcome = error.outcome;
          } else if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
            outcome = "TIMEOUT";
          } else {
            if (error instanceof AiError && error.code === "AI_BAD_OUTPUT") outcome = "SCHEMA_REJECTED";
            throw error;
          }
          if (attempt >= 1) throw new AiError("AI_UNAVAILABLE", "The AI service didn't answer in time");
          retries += 1;
          await sleep(1000 + Math.random() * 2000);
        }
      }
    } finally {
      const latencyMs = Math.round(performance.now() - started);
      await options.ledger.record({ ctx, model, latencyMs, retries, outcome, ...usage });
      // Bad output means the service answered, so it doesn't count against the breaker.
      await settleBreaker(provider, breaker, outcome === "OK" || outcome === "SCHEMA_REJECTED");
    }
  }

  function sparkUsage(body: unknown) {
    const usage = (body as { usage?: Record<string, unknown> })?.usage ?? {};
    const inputTokens = Number(usage.input_tokens ?? 0);
    const cachedTokens = Number((usage.input_tokens_details as { cached_tokens?: number } | undefined)?.cached_tokens ?? 0);
    const outputTokens = Number(usage.output_tokens ?? 0);
    return {
      inputTokens,
      cachedTokens,
      outputTokens,
      audioSeconds: 0,
      costUsd:
        (inputTokens - cachedTokens) * RATES.sparkIn + cachedTokens * RATES.sparkCachedIn + outputTokens * RATES.sparkOut,
    };
  }

  function messageText(body: unknown): string | undefined {
    const output = (body as { output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> }).output;
    return output
      ?.find((item) => item.type === "message")
      ?.content?.find((part) => part.type === "output_text")?.text;
  }

  return {
    // Muse Spark with a strict JSON schema; the result is parsed again with Zod.
    async structured<T>(ctx: AiContext, request: StructuredRequest<T>): Promise<T> {
      let result: T | undefined;
      await send(
        ctx,
        MODELS.spark,
        "/responses",
        {
          json: {
            model: MODELS.spark,
            // The default effort is high (E-30); always set it.
            reasoning: { effort: request.effort ?? "low" },
            max_output_tokens: request.maxOutputTokens ?? 2000,
            input: [
              { role: "developer", content: request.instructions },
              { role: "user", content: request.input },
            ],
            text: {
              format: { type: "json_schema", name: request.schema.name, strict: true, schema: request.schema.json },
            },
          },
        },
        TIMEOUT_MS.spark,
        (body) => {
          const usage = sparkUsage(body);
          const text = messageText(body);
          let json: unknown;
          try {
            json = text === undefined ? undefined : JSON.parse(text);
          } catch {
            json = undefined;
          }
          const parsed = request.schema.zod.safeParse(json);
          if (!parsed.success) throw new AiError("AI_BAD_OUTPUT", "The model's answer didn't match the schema");
          result = parsed.data;
          return { usage };
        },
      );
      return result as T;
    },

    // Muse Spark with tools (owner commands). Tools only propose; the server
    // validates every argument before anything is shown or saved (doc 03).
    async tools(ctx: AiContext, request: ToolRequest): Promise<{ calls: ToolCall[]; text?: string }> {
      let result: { calls: ToolCall[]; text?: string } = { calls: [] };
      await send(
        ctx,
        MODELS.spark,
        "/responses",
        {
          json: {
            model: MODELS.spark,
            reasoning: { effort: request.effort ?? "low" },
            max_output_tokens: request.maxOutputTokens ?? 1500,
            input: [
              { role: "developer", content: request.instructions },
              { role: "user", content: request.input },
            ],
            tools: request.tools.map((t) => ({ type: "function", strict: true, ...t })),
            // Meta accepts only tool_choice "auto" (errata E-30); the model
            // may answer in text instead, which callers treat as a question.
          },
        },
        TIMEOUT_MS.spark,
        (body) => {
          const output = (body as { output?: Array<{ type: string; name?: string; arguments?: string }> }).output ?? [];
          const calls: ToolCall[] = [];
          for (const item of output) {
            if (item.type !== "function_call" || !item.name) continue;
            try {
              calls.push({ name: item.name, arguments: JSON.parse(item.arguments ?? "{}") });
            } catch {
              throw new AiError("AI_BAD_OUTPUT", "A tool call had invalid arguments");
            }
          }
          result = { calls, text: messageText(body) };
          return { usage: sparkUsage(body) };
        },
      );
      return result;
    },

    // Muse Voice Transcribe (spike S3 / errata E-30 request shape).
    async transcribe(
      ctx: AiContext,
      request: { audio: Uint8Array; keywords: string[]; languageBias?: string[] },
    ): Promise<{ transcript: string; audioDurationMs: number }> {
      let result = { transcript: "", audioDurationMs: 0 };
      const requestPart = {
        model: MODELS.transcribe,
        audioEncoding: "WAV",
        mode: "PUSH_TO_TALK",
        keywords: request.keywords.slice(0, 100),
        languageBias: request.languageBias ?? ["hi", "en"],
      };
      await send(
        ctx,
        MODELS.transcribe,
        "/asr/transcribe",
        {
          form: () => {
            const form = new FormData();
            form.append("request", new Blob([JSON.stringify(requestPart)], { type: "application/json" }), "request.json");
            form.append("audio", new Blob([Buffer.from(request.audio)], { type: "audio/wav" }), "clip.wav");
            return form;
          },
          formKey: { ...requestPart, audioSha256: createHash("sha256").update(request.audio).digest("hex") },
        },
        TIMEOUT_MS.transcribe,
        (body) => {
          const parsed = z
            .object({ transcript: z.string(), audioDurationMs: z.number().nonnegative() })
            .safeParse(body);
          if (!parsed.success) throw new AiError("AI_BAD_OUTPUT", "The transcription response was not understood");
          result = parsed.data;
          const audioSeconds = Math.ceil(parsed.data.audioDurationMs / 1000);
          return {
            usage: {
              inputTokens: 0,
              cachedTokens: 0,
              outputTokens: 0,
              audioSeconds,
              costUsd: audioSeconds * RATES.transcribePerSecond,
            },
          };
        },
      );
      return result;
    },
  };
}

export type MetaClient = ReturnType<typeof createMetaClient>;
