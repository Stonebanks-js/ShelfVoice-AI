import { describe, expect, it } from "vitest";

import { categories, matches, type StockProduct } from "./stock";

const product = (name: string, category: string | null, aliases: string[] = []): StockProduct => ({
  id: name,
  name,
  unit: null,
  category,
  aliases,
  price_paise: null,
  stock_qty: null,
  is_in_stock: true,
  low_stock_level: 2,
  product_forecasts: null,
});

describe("Stock search and chips (doc 06 O-6)", () => {
  it("finds products by name or spoken alias, any case", () => {
    const atta = product("Aashirvaad Atta 5 kg", "Staples", ["aata", "आटा"]);
    expect(matches(atta, "atta")).toBe(true);
    expect(matches(atta, "  AASHIRVAAD   atta ")).toBe(true);
    expect(matches(atta, "आटा")).toBe(true);
    expect(matches(atta, "maggi")).toBe(false);
    expect(matches(atta, "")).toBe(true);
  });

  it("orders category chips by how many products they hold", () => {
    const list = [product("a", "Snacks"), product("b", "Snacks"), product("c", "Dairy"), product("d", null)];
    expect(categories(list, "Other")).toEqual(["Snacks", "Dairy", "Other"]);
  });
});
