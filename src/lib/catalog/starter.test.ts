import { describe, expect, it } from "vitest";

import { matchStarter, SHOP_TYPES, STARTER_ITEMS, starterFor, typeForCategory } from "./starter";

describe("ready-made product lists", () => {
  it("gives every shop type a list to start from", () => {
    for (const type of SHOP_TYPES) expect(starterFor(type).length).toBeGreaterThan(25);
    expect(starterFor("kirana").length).toBeGreaterThan(100);
  });

  it("has one key per item and sane prices", () => {
    expect(new Set(STARTER_ITEMS.map((i) => i.key)).size).toBe(STARTER_ITEMS.length);
    for (const item of STARTER_ITEMS) {
      expect(item.pricePaise).toBeGreaterThan(0);
      expect(item.pricePaise).toBeLessThanOrEqual(1_000_00);
      expect(item.types.length).toBeGreaterThan(0);
      expect(item.aliases.length).toBeLessThanOrEqual(10);
    }
  });

  it("matches names read off a shelf or bill", () => {
    expect(matchStarter("Tata Salt", "1 kg")?.key).toBe("tata-salt-1-kg");
    expect(matchStarter("PARLE-G", "80g")?.key).toBe("parle-g-80-g");
    expect(matchStarter("Parle G Biscuit 250 g", "250 g")?.key).toBe("parle-g-250-g");
    expect(matchStarter("Haldiram Aloo Bhujia")?.name).toBe("Haldiram's Aloo Bhujia");
    expect(matchStarter("Maggi Noodles", "70 g")?.key).toBe("maggi-2-minute-noodles-70-g");
  });

  it("doesn't guess from too little", () => {
    expect(matchStarter("Maggi")).toBeNull();
    expect(matchStarter("Local Namkeen")).toBeNull();
    expect(matchStarter("")).toBeNull();
    expect(matchStarter("500 g")).toBeNull();
  });
});

describe("shop type from the shop's category", () => {
  it.each([
    ["Kirana", "kirana"],
    [null, "kirana"],
    ["Dairy and bakery", "dairy_bakery"],
    ["Paan shop", "pan"],
    ["Departmental store", "departmental"],
    ["Sharma Mart", "departmental"],
  ] as const)("%s → %s", (category, type) => {
    expect(typeForCategory(category)).toBe(type);
  });
});
