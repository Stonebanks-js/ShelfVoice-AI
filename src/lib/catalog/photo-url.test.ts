import { describe, expect, it } from "vitest";

import { catalogMatch } from "./photo-url";

const file = (name: string, unit?: string | null) => catalogMatch(name, unit)?.file ?? null;

describe("finding a ready-made image for an owner's product", () => {
  it("takes the same name and pack", () => {
    expect(file("Tata Salt", "1 kg")).toBe("tata-salt-1-kg.webp");
  });

  it("takes the same product written differently, or with no size", () => {
    expect(file("tata salt")).toBe("tata-salt-1-kg.webp");
    expect(file("Parle-G Biscuit", "80 g")).toBe("parle-g-80-g.webp");
    expect(file("Parle G", "250g")).toBe("parle-g-250-g.webp");
  });

  it("refuses another variant or another size", () => {
    expect(file("Aashirvaad Multigrain Atta", "5 kg")).toBeNull();
    expect(file("Aashirvaad Atta", "1 kg")).toBeNull();
  });

  it("refuses a word that could be several brands", () => {
    expect(file("Salt", "1 kg")).toBeNull();
    expect(file("")).toBeNull();
  });
});
