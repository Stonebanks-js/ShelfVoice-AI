import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ApiError, fromPostgres, readJson, route } from "./http";
import { liveTransport } from "./ai/transport";

const req = (init: RequestInit & { url?: string } = {}) => new Request(init.url ?? "https://shop.example/api/v1/x", init);

describe("route wrapper (doc 02 contract rules)", () => {
  it("returns the handler's response with a request ID", async () => {
    const handler = route(async () => Response.json({ ok: true }));
    const res = await handler(req({ headers: { "x-request-id": "req-1" } }), {});
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBe("req-1");
  });

  it("maps errors to the single error shape without leaking details", async () => {
    const api = await route(async () => {
      throw new ApiError(409, "STOCK_NEGATIVE", "Stock would go below zero");
    })(req(), {});
    expect(api.status).toBe(409);
    expect(await api.json()).toEqual({ error: { code: "STOCK_NEGATIVE", message: "Stock would go below zero" } });

    const zod = await route(async () => {
      z.object({ qty: z.number() }).parse({ qty: "x" });
      return new Response();
    })(req(), {});
    expect(zod.status).toBe(422);
    expect((await zod.json()).error.code).toBe("VALIDATION");

    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const crash = await route(async () => {
      throw new Error("secret internals");
    })(req(), {});
    expect(crash.status).toBe(500);
    expect(JSON.stringify(await crash.json())).not.toContain("secret internals");
    errorLog.mockRestore();
  });

  it("refuses cross-origin writes but allows same-origin and reads (doc 03 TH-09)", async () => {
    const ok = route(async () => new Response(null, { status: 204 }));
    expect((await ok(req({ method: "POST", headers: { origin: "https://evil.example" } }), {})).status).toBe(403);
    expect((await ok(req({ method: "POST", headers: { origin: "https://shop.example" } }), {})).status).toBe(204);
    expect((await ok(req({ method: "GET", headers: { origin: "https://evil.example" } }), {})).status).toBe(204);
  });

  it("requires JSON bodies", async () => {
    const Body = z.object({ name: z.string() });
    await expect(readJson(req({ method: "POST", body: "x", headers: { "content-type": "text/plain" } }), Body)).rejects.toMatchObject({ status: 415 });
    await expect(readJson(req({ method: "POST", body: "{bad", headers: { "content-type": "application/json" } }), Body)).rejects.toMatchObject({ status: 400 });
    await expect(readJson(req({ method: "POST", body: '{"name":"a"}', headers: { "content-type": "application/json" } }), Body)).resolves.toEqual({ name: "a" });
  });

  it("maps database errors by their hint", () => {
    expect(fromPostgres({ message: "x", hint: "STOCK_NEGATIVE" })).toMatchObject({ status: 409, code: "STOCK_NEGATIVE" });
    expect(fromPostgres({ message: "x", code: "23505" })).toMatchObject({ status: 409 });
    expect(fromPostgres({ message: "x", code: "23514" })).toMatchObject({ status: 422 });
    expect(fromPostgres({ message: "x", code: "42501" })).toMatchObject({ status: 404 });
    expect(fromPostgres({ message: "x", code: "XX000" })).toMatchObject({ status: 500 });
  });
});

describe("live transport", () => {
  it("posts JSON with the bearer key and parses the reply", async () => {
    const fetchMock = vi.fn(async () => new Response('{"ok":1}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await liveTransport("https://api.example/v1/", "key-123")("/responses", { json: { a: 1 }, timeoutMs: 1000 });
    expect(res).toEqual({ status: 200, body: { ok: 1 } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example/v1/responses");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer key-123");
    vi.unstubAllGlobals();
  });

  it("returns non-JSON bodies as text", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("gateway down", { status: 502 })));
    expect(await liveTransport("https://api.example/v1", "k")("/responses", { json: {}, timeoutMs: 1000 })).toEqual({ status: 502, body: "gateway down" });
    vi.unstubAllGlobals();
  });
});
