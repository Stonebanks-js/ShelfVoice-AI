import { describe, expect, it } from "vitest";

import type { Change } from "@/server/changes";

import { describeChange, formatPhone, formatRupees, needsCheck, type CatalogEntry } from "./changes-view";

const MAGGI = "11111111-1111-4111-8111-111111111111";
const catalog: CatalogEntry[] = [{ id: MAGGI, name: "Maggi", price_paise: 1400 }];

describe("change sentences (doc 06 O-4)", () => {
  it.each<[Change, string, string]>([
    [{ op: "update_price", product_id: MAGGI, price_paise: 1500 }, "Maggi: price ₹14 → ₹15", "Maggi: दाम ₹14 → ₹15"],
    [{ op: "set_in_stock", product_id: MAGGI, in_stock: false }, "Maggi: out of stock", "Maggi: स्टॉक ख़त्म"],
    [{ op: "set_stock_count", product_id: MAGGI, count: 12 }, "Maggi: 12 on the shelf", "Maggi: शेल्फ़ पर 12"],
    [{ op: "record_sale", product_id: MAGGI, qty: 3 }, "Sold 3 × Maggi", "Maggi के 3 बिके"],
    [{ op: "record_delivery", product_id: MAGGI, qty: 24 }, "Delivered 24 × Maggi", "Maggi के 24 आए"],
    [{ op: "add_product", name: "Parle-G", price_paise: 1000 }, "Add Parle-G", "Parle-G जोड़ें"],
  ])("%j reads as a sentence", (change, en, hi) => {
    expect(describeChange(change, catalog, "en").title).toBe(en);
    expect(describeChange(change, catalog, "hi").title).toBe(hi);
  });

  it("lists shop details one per line", () => {
    const view = describeChange({ op: "update_shop", name: "Sharma Kirana", phone: "+919876543210" }, catalog, "en");
    expect(view).toEqual({ title: "Shop details", details: ["Name: Sharma Kirana", "Phone: +91 98765 43210"] });
  });

  it("never shows a raw ID for an unknown product", () => {
    const view = describeChange({ op: "record_sale", product_id: "22222222-2222-4222-8222-222222222222", qty: 1 }, catalog, "en");
    expect(view.title).toBe("Sold 1 × an item");
  });

  it("marks a new product with no price heard as Please check", () => {
    expect(needsCheck({ op: "add_product", name: "Atta", price_paise: null })).toBe(true);
    expect(needsCheck({ op: "add_product", name: "Atta", price_paise: 28_500 })).toBe(false);
    expect(describeChange({ op: "add_product", name: "Atta", price_paise: null }, catalog, "en").details).toEqual(["No price heard"]);
  });

  it("formats rupees and phones the Indian way", () => {
    expect(formatRupees(1_25_000_00)).toBe("₹1,25,000");
    expect(formatRupees(1450)).toBe("₹14.50");
    expect(formatPhone("+919876543210")).toBe("+91 98765 43210");
  });
});
