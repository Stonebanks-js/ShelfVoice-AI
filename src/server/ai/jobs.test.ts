import { describe, expect, it } from "vitest";

import { type CatalogItem, interpretCommand, rivalsFor, templateExplanation } from "./jobs";
import type { MetaClient } from "./meta";

// The restock reason shown until (or instead of) Muse Spark's wording.
describe("restock reason template", () => {
  const input = { productName: "Haldiram Bhujia", orderQty: 12, daysLeft: 1.5, dailyDemand: 4, stock: 6, leadTimeDays: 2, customerFlagged: false, language: "en" as const };

  it("names a festival that raised the quantity (W-19)", () => {
    expect(templateExplanation({ ...input, festival: "Diwali" })).toBe("Haldiram Bhujia: sells about 4 a day and 6 are left. Order 12. Diwali is coming up.");
    expect(templateExplanation({ ...input, festival: "Diwali", language: "hi" })).toContain("12 mangwa lo. Diwali paas hai.");
  });

  it("says nothing about festivals otherwise", () => {
    expect(templateExplanation(input)).toBe("Haldiram Bhujia: sells about 4 a day and 6 are left. Order 12.");
    expect(templateExplanation({ ...input, festival: null, customerFlagged: true })).toBe(
      "Haldiram Bhujia: sells about 4 a day and 6 are left. Order 12. A customer asked for this.",
    );
  });
});

// The code's own checks on the model's tool calls, with the model replaced
// by fixed answers (the live evals in tests/live cover the model itself).
describe("voice command checks", () => {
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const catalog: CatalogItem[] = [
    { id: id(1), name: "Maggi 2-Minute Noodles", aliases: ["maggi"], price_paise: 1400, stock_qty: 18 },
    { id: id(2), name: "Parle-G Biscuit", aliases: ["parle g", "parle"], price_paise: 1000, stock_qty: 60 },
    { id: id(5), name: "Tata Salt", aliases: ["namak", "salt"], price_paise: 2800, stock_qty: 30 },
    { id: id(7), name: "Tata Tea Gold", aliases: ["chai patti"], price_paise: 15000, stock_qty: 8 },
  ];
  const twoMaggi = [...catalog, { id: id(6), name: "Maggi Atta Noodles", aliases: ["maggi atta"], price_paise: 2000, stock_qty: 10 }];
  const answering = (...calls: Array<{ name: string; arguments: Record<string, unknown> }>) =>
    ({ tools: async () => ({ calls, text: null }) }) as unknown as MetaClient;
  const ctx = { job: "COMMAND" as const };

  it("drops a sale price that only repeats the catalog's, and keeps one that was said", async () => {
    const repeated = await interpretCommand(answering({ name: "record_sale", arguments: { product_id: id(2), qty: 12, price_rupees: 10 } }), ctx, "aaj 12 packet Parle-G gaye", catalog);
    expect(repeated.changes).toEqual([{ op: "record_sale", product_id: id(2), qty: 12, unit_price_paise: null }]);
    const said = await interpretCommand(answering({ name: "record_sale", arguments: { product_id: id(2), qty: 12, price_rupees: 9 } }), ctx, "12 Parle-G 9 rupaye mein beche", catalog);
    expect(said.changes).toEqual([{ op: "record_sale", product_id: id(2), qty: 12, unit_price_paise: 900 }]);
  });

  it("asks which one when the words fit two products, in the shop's language", async () => {
    const call = { name: "update_price", arguments: { product_id: id(1), price_rupees: 15 } };
    const en = await interpretCommand(answering(call), ctx, "Maggi ka price 15 kar do", twoMaggi);
    expect(en.changes).toEqual([]);
    expect(en.question).toBe("Which one did you mean: Maggi 2-Minute Noodles or Maggi Atta Noodles?");
    const hi = await interpretCommand(answering(call), ctx, "Maggi ka price 15 kar do", twoMaggi, "hi");
    expect(hi.question).toBe("आपका मतलब कौन सा था: Maggi 2-Minute Noodles या Maggi Atta Noodles?");
  });

  it("keeps a change when the words name one product most specifically", async () => {
    const r = await interpretCommand(answering({ name: "update_price", arguments: { product_id: id(6), price_rupees: 22 } }), ctx, "Maggi atta noodles ka price 22", twoMaggi);
    expect(r.changes).toEqual([{ op: "update_price", product_id: id(6), price_paise: 2200 }]);
    expect(r.question).toBeNull();
  });

  it("only compares names that appear in the transcript", () => {
    // A shared brand, but the alias picks one out.
    expect(rivalsFor(catalog[2], "Tata namak do packet bike", catalog)).toEqual([]);
    // Picking the less specific of two named products is a guess too.
    expect(rivalsFor(twoMaggi[0], "maggi atta ka price 22", twoMaggi).map((p) => p.id)).toEqual([id(6)]);
    // Spoken in Devanagari, catalog names in Latin: nothing to compare.
    expect(rivalsFor(twoMaggi[0], "मैगी का दाम 15 कर दो", twoMaggi)).toEqual([]);
  });
});
