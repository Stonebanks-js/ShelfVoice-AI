import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { budgetAlert, ledger } from "./ai/index";
import { flushLogs, log, release, resetLogSinks, sendAlert } from "./log";

const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));

beforeEach(() => {
  resetLogSinks();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const calls = () => fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;

describe("Axiom shipping (doc 05 O1)", () => {
  it("sends nothing without a token", async () => {
    log("info", "test.event");
    await flushLogs();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("batches redacted lines into one ingest call", async () => {
    vi.stubEnv("AXIOM_TOKEN", "xaat-test");
    vi.stubEnv("AXIOM_DATASET", "shelfvoice");
    log("info", "first.event", { shopId: "s1" });
    log("warn", "second.event", { transcript: "private words" });
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = calls()[0];
    expect(url).toBe("https://api.axiom.co/v1/datasets/shelfvoice/ingest?timestamp-field=ts");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer xaat-test");
    const lines = String(init.body).split("\n").map((l) => JSON.parse(l));
    expect(lines.map((l) => l.event)).toEqual(["first.event", "second.event"]);
    expect(lines[1].transcript).toBe("[redacted]");
  });

  it("survives Axiom being down", async () => {
    vi.stubEnv("AXIOM_TOKEN", "xaat-test");
    vi.stubEnv("AXIOM_DATASET", "shelfvoice");
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    log("info", "test.event");
    await expect(flushLogs()).resolves.toBeUndefined();
  });
});

describe("Discord alerts (doc 05 O4)", () => {
  beforeEach(() => vi.stubEnv("DISCORD_ALERT_WEBHOOK_URL", "https://discord.example/hook"));

  it("posts error events once per 10 minutes, redacted, with no pings", async () => {
    log("error", "ai.breaker.open", { provider: "meta", token: "sk-123" });
    log("error", "ai.breaker.open", { provider: "meta" });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String(calls()[0][1].body));
    expect(body.content).toContain("**HIGH** `ai.breaker.open`");
    expect(body.content).not.toContain("sk-123");
    expect(body.allowed_mentions).toEqual({ parse: [] });
  });

  it("does not alert on warnings", async () => {
    log("warn", "health.not_ready");
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tags the release with the deploy's commit", () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "9e588fd1234567");
    expect(release()).toBe("9e588fd");
  });

  it.each([
    [49.9, 0.2, "ai.budget.50pct", "MEDIUM"],
    [79.5, 1, "ai.budget.80pct", "MEDIUM"],
    [94.99, 0.05, "ai.budget.95pct", "CRITICAL"],
  ])("alerts when spend crosses a budget line (%s + %s)", async (before, cost, event, severity) => {
    vi.spyOn(ledger, "spend").mockResolvedValue({ totalUsd: before + cost, todayUsd: 0, shopTodayUsd: 0 });
    await budgetAlert(cost);
    const body = JSON.parse(String(calls()[0][1].body));
    expect(body.content).toContain(`**${severity}** \`${event}\``);
  });

  it("stays quiet between budget lines", async () => {
    vi.spyOn(ledger, "spend").mockResolvedValue({ totalUsd: 60, todayUsd: 0, shopTodayUsd: 0 });
    await budgetAlert(0.5);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never throws when Discord is down", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(sendAlert("critical", "test.down")).resolves.toBeUndefined();
  });
});
