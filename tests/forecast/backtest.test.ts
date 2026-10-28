// Doc 04 "Forecast backtest": replay 90 days of seeded sales day by day and
// judge the reorder policy against the gates. Fixed seed, so results repeat.
import { describe, expect, it } from "vitest";

import { poisson, rng } from "@/server/demo/template";
import { forecast, roundUpToPack, stdDev } from "@/server/forecast/formula";

const DAYS = 90;
const START = 30;
const L = 2;
const R = 7;

interface Item {
  demand: number[];
}

// 40 typical kirana items: base daily rates from slow sellers (many zero
// days) to fast movers, a weekend lift, a 5-day festival spike, Poisson noise.
function generate(seed = 404): Item[] {
  const random = rng(seed);
  return Array.from({ length: 40 }, (_, i) => {
    const rate = i < 8 ? 0.3 + random() * 0.7 : 1 + random() * 24;
    const demand = Array.from({ length: DAYS }, (_, day) => {
      const weekend = day % 7 === 5 || day % 7 === 6 ? 1.3 : 1;
      const festival = day >= 60 && day < 65 ? 1.8 : 1;
      return poisson(rate * weekend * festival, random);
    });
    return { demand };
  });
}

type Policy = (sales: number[], day: number, stock: number) => { warn: boolean; order: number };

// Shelf Voice: the doc 02 formula on what the shop has actually sold.
const shelfVoice: Policy = (sales, day, stock) => {
  const f = forecast({ dailySales: sales, historyDays: day, stock, leadTimeDays: L, reviewPeriodDays: R, packSize: 1, lowStockLevel: 5 });
  return { warn: f.needsReorder, order: f.needsReorder ? (f.orderQty ?? 0) : 0 };
};

// Baseline: reorder only when the shelf is empty.
const whenEmpty: Policy = (sales, _day, stock) => {
  if (stock > 0) return { warn: false, order: 0 };
  const mean = sales.slice(-28).reduce((a, b) => a + b, 0) / Math.min(28, sales.length);
  return { warn: true, order: Math.ceil(mean * (L + R)) };
};

// Comparison: the same reorder rule with a plain 4-week moving average.
const movingAverage: Policy = (sales, _day, stock) => {
  const window = sales.slice(-28);
  const d = window.reduce((a, b) => a + b, 0) / window.length;
  const ss = 1.28 * stdDev(window) * Math.sqrt(L);
  const reorder = stock <= d * L + ss;
  return { warn: reorder, order: reorder ? roundUpToPack(d * (L + R) + ss - stock, 1) : 0 };
};

interface Run {
  stockoutDays: number;
  stockoutEvents: number;
  warnedAhead: number;
  unitsOnHand: number; // summed end-of-day stock
  dayCount: number;
}

function simulate(item: Item, policy: Policy): Run {
  // Before day 30 the shop was fully stocked, so sales equal demand.
  const sales = item.demand.slice(0, START);
  let stock = Math.round((sales.reduce((a, b) => a + b, 0) / START) * 14);
  const arrivals = new Map<number, number>();
  const warnings: boolean[] = [];
  const out: boolean[] = [];
  const run: Run = { stockoutDays: 0, stockoutEvents: 0, warnedAhead: 0, unitsOnHand: 0, dayCount: 0 };

  for (let day = START; day < DAYS; day++) {
    stock += arrivals.get(day) ?? 0;
    const pending = [...arrivals.keys()].some((d) => d > day);
    const decision = policy(sales, day, stock);
    warnings[day] = decision.warn;
    if (decision.order > 0 && !pending) arrivals.set(day + L, decision.order);

    const demand = item.demand[day];
    const sold = Math.min(stock, demand);
    sales.push(sold); // lost sales are invisible to the policy, as in a real shop
    stock -= sold;
    out[day] = demand > sold;

    if (out[day]) {
      run.stockoutDays += 1;
      if (!out[day - 1]) {
        run.stockoutEvents += 1;
        if (warnings.slice(Math.max(START, day - 14), day - 1).some(Boolean)) run.warnedAhead += 1;
      }
    }
    run.unitsOnHand += stock;
    run.dayCount += 1;
  }
  return run;
}

function total(items: Item[], policy: Policy): Run {
  return items.map((item) => simulate(item, policy)).reduce((a, b) => ({
    stockoutDays: a.stockoutDays + b.stockoutDays,
    stockoutEvents: a.stockoutEvents + b.stockoutEvents,
    warnedAhead: a.warnedAhead + b.warnedAhead,
    unitsOnHand: a.unitsOnHand + b.unitsOnHand,
    dayCount: a.dayCount + b.dayCount,
  }));
}

describe("forecast backtest (doc 04)", () => {
  const items = generate();
  const ours = total(items, shelfVoice);
  const baseline = total(items, whenEmpty);
  const ma = total(items, movingAverage);

  it("reports its numbers", () => {
    console.log(
      JSON.stringify({
        shelfVoice: ours,
        whenEmpty: baseline,
        movingAverage: ma,
        warnedShare: ours.stockoutEvents ? ours.warnedAhead / ours.stockoutEvents : 1,
        stockoutReduction: 1 - ours.stockoutDays / baseline.stockoutDays,
        onHandVsMovingAverage: ours.unitsOnHand / ma.unitsOnHand,
      }),
    );
  });

  it("warns at least 2 days ahead of at least 80% of stock-outs", () => {
    expect(ours.stockoutEvents === 0 || ours.warnedAhead / ours.stockoutEvents >= 0.8).toBe(true);
  });

  it("has at least 50% fewer stock-out days than reordering when empty", () => {
    expect(ours.stockoutDays).toBeLessThanOrEqual(baseline.stockoutDays * 0.5);
  });

  it("holds no more than 10% more stock than a 4-week moving-average policy", () => {
    expect(ours.unitsOnHand).toBeLessThanOrEqual(ma.unitsOnHand * 1.1);
  });
});
