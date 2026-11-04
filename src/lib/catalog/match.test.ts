import { describe, expect, it } from "vitest";

import { confident, judge, parseAmount, rank, sameAmount, words } from "./match";

describe("pack sizes", () => {
  it("reads grams, litres and pieces", () => {
    expect(parseAmount("5 kg")).toEqual({ value: 5000, dim: "g" });
    expect(parseAmount("1kg")).toEqual({ value: 1000, dim: "g" });
    expect(parseAmount("500 g")).toEqual({ value: 500, dim: "g" });
    expect(parseAmount("1 L")).toEqual({ value: 1000, dim: "ml" });
    expect(parseAmount("200ml")).toEqual({ value: 200, dim: "ml" });
    expect(parseAmount("10 pcs")).toEqual({ value: 10, dim: "pc" });
    expect(parseAmount("0,5 kg")).toEqual({ value: 500, dim: "g" });
  });

  it("can't prove a multipack or an unreadable size", () => {
    expect(parseAmount("2 x 100 g")).toBeNull();
    expect(parseAmount("family pack")).toBeNull();
    expect(parseAmount(null)).toBeNull();
  });

  it("treats 1 kg and 1000 g as one size, 5 kg and 10 kg as two", () => {
    expect(sameAmount(parseAmount("1 kg"), parseAmount("1000 g"))).toBe(true);
    expect(sameAmount(parseAmount("5 kg"), parseAmount("10 kg"))).toBe(false);
    expect(sameAmount(parseAmount("500 ml"), parseAmount("500 g"))).toBe(false);
  });
});

describe("names", () => {
  it("keeps the words, without case, accents, punctuation or sizes", () => {
    expect(words("Parle-G Biscuits 100g")).toEqual(["parle", "biscuit"]); // "G" reads as grams on both sides
    expect(words("Café Coffee & Milk")).toEqual(["cafe", "coffee", "and", "milk"]);
  });
});

describe("matching a photo to a product", () => {
  const atta = { name: "Aashirvaad Atta", unit: "5 kg" };

  it("takes the same product in the same pack", () => {
    expect(judge(atta, { code: "1", name: "Aashirvaad Superior MP Atta", brands: "Aashirvaad, ITC", quantity: "5 kg" }).status).toBe("exact");
    expect(judge({ name: "Parle-G", unit: "100 g" }, { code: "2", name: "Parle-G Gold", quantity: "100 g" }).status).toBe("no");
    expect(judge({ name: "Parle-G Biscuit", unit: "100 g" }, { code: "3", name: "Parle G Biscuits", quantity: "100g" }).status).toBe("exact");
  });

  it("refuses another size or another variant of the same brand", () => {
    expect(judge(atta, { code: "4", name: "Aashirvaad Atta", quantity: "10 kg" }).reason).toBe("another pack size");
    expect(judge(atta, { code: "5", name: "Aashirvaad Multigrain Atta", quantity: "5 kg" }).reason).toBe("another variant (multigrain)");
    expect(judge(atta, { code: "6", name: "Aashirvaad Select Atta", quantity: "5 kg" }).status).toBe("no");
    expect(judge({ name: "Maggi Noodles", unit: "70 g" }, { code: "7", name: "Maggi Atta Noodles", quantity: "70 g" }).status).toBe("no");
  });

  it("refuses another product that only shares the brand", () => {
    expect(judge({ name: "Tata Salt", unit: "1 kg" }, { code: "8", name: "Tata Tea Premium", quantity: "1 kg" }).status).toBe("no");
  });

  it("is unsure when the pack size is unknown, sure on the same barcode", () => {
    expect(judge(atta, { code: "9", name: "Aashirvaad Atta" }).status).toBe("uncertain");
    expect(judge({ ...atta, barcode: "8901725016838" }, { code: "8901725016838", name: "Something else", quantity: "1 kg" }).status).toBe("exact");
  });

  it("ranks the best first, drops duplicates, and asks when two are close", () => {
    const ranked = rank(atta, [
      { code: "a", name: "Aashirvaad Atta", quantity: "5 kg" },
      { code: "a", name: "Aashirvaad Atta", quantity: "5 kg" },
      { code: "b", name: "Aashirvaad Atta", quantity: "10 kg" },
      { code: "c", name: "Aashirvaad Atta" },
    ]);
    expect(ranked.map((m) => m.candidate.code)).toEqual(["a", "c"]);
    expect(confident(ranked)?.candidate.code).toBe("a");

    const close = rank(atta, [
      { code: "x", name: "Aashirvaad Atta Easy", quantity: "5 kg" },
      { code: "y", name: "Aashirvaad Atta Smart", quantity: "5 kg" },
    ]);
    expect(close.length).toBe(2);
    expect(confident(close)).toBeNull();
    expect(confident(rank(atta, [{ code: "z", name: "Aashirvaad Atta" }]))).toBeNull();
  });
});
