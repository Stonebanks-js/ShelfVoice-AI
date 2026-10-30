import { describe, expect, it } from "vitest";

import { isNoise, pageFor, scrub } from "./report";

describe("browser error reports (doc 05)", () => {
  it("names pages without record IDs", () => {
    expect(pageFor("/app/check/5d7239b6-b0c5-401d-a83f-63390b8a4511")).toBe("/app/check/:id");
    expect(pageFor("/s/sharma-kirana-k3f9")).toBe("/s/sharma-kirana-k3f9");
  });

  it.each([
    ["Script error.", undefined, undefined, true],
    ["ResizeObserver loop completed with undelivered notifications.", undefined, undefined, true],
    ["x is not a function", "chrome-extension://abc/content.js", undefined, true],
    ["x is not a function", undefined, "at f (moz-extension://abc/a.js:1:2)", true],
    ["Cannot read properties of undefined (reading 'id')", "https://shelfvoice.vercel.app/_next/static/chunks/a.js", undefined, false],
  ])("treats %s as noise: %s", (message, source, stack, noise) => {
    expect(isNoise(message, source, stack)).toBe(noise);
  });

  it("drops query strings and fragments from URLs", () => {
    expect(scrub("at f (https://x.supabase.co/storage/v1/object/sign/voice/a.wav?token=secret:1:2)", 500)).toBe(
      "at f (https://x.supabase.co/storage/v1/object/sign/voice/a.wav:1:2)",
    );
  });
});
