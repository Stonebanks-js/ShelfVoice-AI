import { describe, expect, it } from "vitest";

import { english, langFromAcceptLanguage, langFromRegion, REGIONAL, registerMessages, translate } from "./dictionary";
import * as locales from "./server";

describe("interface dictionary", () => {
  it("fills placeholders in both languages", () => {
    expect(translate("en", "toast.saved", { n: 3 })).toBe("3 changes saved");
    expect(translate("hi", "toast.saved", { n: 3 })).toBe("3 बदलाव सेव हुए");
  });

  it("leaves unknown placeholders visible rather than blank", () => {
    expect(translate("en", "toast.saved")).toBe("{n} changes saved");
  });

  it.each([
    ["hi-IN,hi;q=0.9,en;q=0.8", "hi"],
    ["hi", "hi"],
    ["en-IN,en;q=0.9,hi;q=0.8", "en"],
    ["mr-IN", "mr"],
    ["ta", "ta"],
    ["fr-FR,fr", "en"],
    [null, "en"],
  ])("follows the phone's first language (%s)", (header, lang) => {
    expect(langFromAcceptLanguage(header)).toBe(lang);
  });
});

describe("regional languages", () => {
  const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

  it.each(REGIONAL)("%s keeps every {placeholder} and has no stray keys", (lang) => {
    const messages = locales.messagesFor(lang)!;
    for (const [key, text] of Object.entries(messages)) {
      expect(english).toHaveProperty(key);
      expect(placeholders(text!), key).toBe(placeholders(english[key as keyof typeof english]));
      expect(text!.trim(), key).not.toBe("");
    }
  });

  it("falls back to English for a key a language doesn't have yet", () => {
    registerMessages("pa", { "tab.home": "ਹੋਮ" });
    expect(translate("pa", "tab.home")).toBe("ਹੋਮ");
    expect(translate("pa", "tab.orders")).toBe("Orders");
  });

  it.each([
    ["IN", "KA", { state: "Karnataka", lang: "kn" }],
    ["IN", "tn", { state: "Tamil Nadu", lang: "ta" }],
    ["IN", "UP", { state: "Uttar Pradesh", lang: "hi" }],
    ["IN", "GA", null],
    ["US", "CA", null],
    [null, null, null],
  ] as const)("suggests a language from the region (%s %s)", (country, region, expected) => {
    expect(langFromRegion(country, region)).toEqual(expected);
  });
});
