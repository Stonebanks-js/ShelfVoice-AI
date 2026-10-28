import { describe, expect, it } from "vitest";

import { forecast, roundUpToPack, smooth, stdDev } from "./formula";

const base = { historyDays: 90, leadTimeDays: 2, reviewPeriodDays: 7, packSize: 1, lowStockLevel: 5 };

describe("forecast formula (doc 02)", () => {
  it("smooths a flat series to its level", () => {
    expect(smooth(Array(30).fill(9))).toBeCloseTo(9, 9);
  });

  it("weights recent days by the tuned alpha 0.2", () => {
    // Warm-up mean of the first week [10, 20] is 15; then 0.2 * 10 + 0.8 * 15 = 14;
    // then 0.2 * 20 + 0.8 * 14 = 15.2.
    expect(smooth([10, 20])).toBeCloseTo(15.2, 9);
    expect(smooth([10, 20], 0.3)).toBeCloseTo(15.45, 9);
  });

  it("uses the sample standard deviation", () => {
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    expect(stdDev([5])).toBe(0);
  });

  it("rounds order quantities up to whole packs", () => {
    expect(roundUpToPack(120.2, 48)).toBe(144);
    expect(roundUpToPack(0, 48)).toBe(0);
    expect(roundUpToPack(-3, 1)).toBe(0);
  });

  it("matches the formula by hand for a steady seller", () => {
    // Demand 9/day exactly, no variation: SS = 0, ROP = 18, Q = 9 * 9 - 18 = 63.
    const f = forecast({ ...base, dailySales: Array(30).fill(9), stock: 18 });
    expect(f.demand).toBeCloseTo(9, 9);
    expect(f.safetyStock).toBe(0);
    expect(f.reorderPoint).toBeCloseTo(18, 9);
    expect(f.orderQty).toBe(63);
    expect(f.daysLeft).toBeCloseTo(2, 9);
    expect(f.needsReorder).toBe(true);
  });

  it("adds safety stock z * sigma * sqrt(L)", () => {
    const series = Array.from({ length: 28 }, (_, i) => (i % 2 ? 6 : 12));
    const f = forecast({ ...base, dailySales: series, stock: 100 });
    expect(f.safetyStock).toBeCloseTo(1.28 * stdDev(series) * Math.sqrt(2), 9);
    expect(f.needsReorder).toBe(false);
  });

  it("raises demand by 1.2 for an item a customer flagged as out of stock", () => {
    const flat = Array(30).fill(10);
    expect(forecast({ ...base, dailySales: flat, stock: 50, stockoutFlagged: true }).demand).toBeCloseTo(12, 9);
  });

  it("applies the festival factor", () => {
    expect(forecast({ ...base, dailySales: Array(30).fill(10), stock: 50, festivalFactor: 1.5 }).demand).toBeCloseTo(15, 9);
  });

  it("uses the owner's low-stock level during cold start and suggests no quantity", () => {
    const f = forecast({ ...base, historyDays: 10, dailySales: Array(10).fill(3), stock: 4 });
    expect(f.coldStart).toBe(true);
    expect(f.orderQty).toBeNull();
    expect(f.reorderPoint).toBeNull();
    expect(f.needsReorder).toBe(true);
    expect(forecast({ ...base, historyDays: 10, dailySales: Array(10).fill(3), stock: 6 }).needsReorder).toBe(false);
  });

  it("never asks to reorder an item whose count isn't tracked", () => {
    const f = forecast({ ...base, dailySales: Array(30).fill(5), stock: null });
    expect(f.needsReorder).toBe(false);
    expect(f.orderQty).toBeNull();
    expect(f.daysLeft).toBeNull();
  });

  it("keeps a perfectly steady slow seller off the list while above its reorder point", () => {
    // 1/day with no variation: SS = 0, ROP = 2, so 3 left is not yet a reorder.
    expect(forecast({ ...base, dailySales: Array(30).fill(1), stock: 3 }).needsReorder).toBe(false);
  });

  it("reproduces the Key Screens order list after errata E-19", () => {
    // Surf Excel sells about 1 a day but unevenly (0, 2, 0, 2 ...): sigma ~1,
    // so SS ~1.8 and ROP ~3.5 >= 3 left, which puts it on the list. The
    // quantity follows Q = ceil(d * (L + R) + SS - stock) exactly.
    const series = Array.from({ length: 29 }, (_, i) => (i % 2 ? 2 : 0));
    const surf = forecast({ ...base, dailySales: series, stock: 3 });
    expect(surf.safetyStock).toBeCloseTo(1.28 * stdDev(series.slice(-28)) * Math.sqrt(2), 9);
    expect(surf.reorderPoint!).toBeGreaterThanOrEqual(3);
    expect(surf.needsReorder).toBe(true);
    expect(surf.orderQty).toBe(Math.ceil(surf.demand * 9 + surf.safetyStock - 3));
  });
});
