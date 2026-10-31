import { describe, expect, it } from "vitest";

import { templateExplanation } from "./jobs";

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
