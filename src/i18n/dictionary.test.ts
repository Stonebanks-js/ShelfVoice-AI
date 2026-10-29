import { describe, expect, it } from "vitest";

import { langFromAcceptLanguage, translate } from "./dictionary";

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
    ["mr-IN", "en"],
    [null, "en"],
  ])("follows the phone's first language (%s)", (header, lang) => {
    expect(langFromAcceptLanguage(header)).toBe(lang);
  });
});
