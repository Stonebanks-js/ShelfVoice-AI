// Nightly job against the local database: auth and the Better Stack
// heartbeat (doc 05: alert if the daily job's ping is 2 hours late).
import { describe, expect, it, vi } from "vitest";

process.env.BETTERSTACK_HEARTBEAT_URL = "https://uptime.example/api/v1/heartbeat/abc";

const realFetch = globalThis.fetch;
const pings: string[] = [];
vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.startsWith("https://uptime.example/")) {
    pings.push(url);
    return Promise.resolve(new Response("OK"));
  }
  return realFetch(input, init);
});

const { GET } = await import("@/app/api/cron/nightly/route");
const secret = process.env.CRON_SECRET!;

describe("nightly cron", () => {
  it("refuses callers without the cron secret", async () => {
    const res = await GET(new Request("http://localhost/api/cron/nightly", { headers: { authorization: "Bearer wrong" } }));
    expect(res.status).toBe(401);
    expect(pings).toEqual([]);
  });

  it("runs and pings the heartbeat", { timeout: 120_000 }, async () => {
    const res = await GET(new Request("http://localhost/api/cron/nightly", { headers: { authorization: `Bearer ${secret}` } }));
    expect(res.status).toBe(200);
    expect((await res.json()).failures).toBe(0);
    expect(pings).toEqual(["https://uptime.example/api/v1/heartbeat/abc"]);
  });
});
