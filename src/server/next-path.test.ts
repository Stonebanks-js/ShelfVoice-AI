import { describe, expect, it } from "vitest";

import { safeNext } from "./next-path";

describe("where sign-in lands", () => {
  it.each([
    [null, "/app"],
    ["/me", "/me"],
    ["/shops", "/shops"],
    ["/s/sharma-kirana-k3f9", "/s/sharma-kirana-k3f9"],
    ["https://evil.example", "/app"],
    ["//evil.example", "/app"],
    ["/s/../admin", "/app"],
    ["/admin", "/app"],
  ])("%s -> %s", (value, expected) => {
    expect(safeNext(value)).toBe(expected);
  });
});
