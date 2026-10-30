import "server-only";

import { isRunningLow } from "./forecast/low";
import type { Db } from "./supabase";

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000;

export interface TodaySummary {
  productCount: number;
  salesPaise: number;
  unitsSold: number;
  // The same stretch of the same weekday last week, for a fair comparison.
  lastWeekPaise: number;
  low: Array<{ id: string; name: string; daysLeft: number | null; orderQty: number | null; flagged: boolean }>;
  lowCount: number;
  reviews: Array<{ id: string; sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | null; summary: string | null; createdAt: string }>;
  newReviews: number;
}

type Sale = { qty: number; unit_price_paise: number | null; products: { price_paise: number | null } | { price_paise: number | null }[] | null };

// A sale is worth its spoken price, else the product's current price.
function revenue(sales: Sale[]): number {
  return sales.reduce((sum, s) => {
    const product = Array.isArray(s.products) ? s.products[0] : s.products;
    return sum + s.qty * (s.unit_price_paise ?? product?.price_paise ?? 0);
  }, 0);
}

// Doc 06 O-5: today's sales, items running low and new reviews, all read
// under the owner's RLS policies. Days are India days.
export async function todaySummary(db: Db, shopId: string, now = new Date()): Promise<TodaySummary> {
  const dayStart = Math.floor((now.getTime() + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;
  const lastWeekStart = dayStart - 7 * DAY_MS;
  const lastWeekNow = now.getTime() - 7 * DAY_MS;
  const iso = (ms: number) => new Date(ms).toISOString();
  const sales = (from: number, to: number) =>
    db
      .from("stock_movements")
      .select("qty, unit_price_paise, products(price_paise)")
      .eq("shop_id", shopId)
      .eq("kind", "SALE")
      .gte("occurred_at", iso(from))
      .lte("occurred_at", iso(to))
      .limit(5000);

  const [today, lastWeek, products, reviews] = await Promise.all([
    sales(dayStart, now.getTime()),
    sales(lastWeekStart, lastWeekNow),
    db
      .from("products")
      .select("id, name, stock_qty, low_stock_level, product_forecasts(days_left, order_qty, reorder_point, stockout_boost_until)")
      .eq("shop_id", shopId)
      .is("archived_at", null),
    db
      .from("reviews")
      .select("id, sentiment, summary, created_at")
      .eq("shop_id", shopId)
      .eq("is_hidden", false)
      // Recordings with no speech say nothing worth showing; ones still being
      // understood (no transcript yet) stay.
      .or("transcript.is.null,transcript.neq.")
      .gte("created_at", iso(now.getTime() - 7 * DAY_MS))
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  for (const r of [today, lastWeek, products, reviews]) if (r.error) throw r.error;

  const low = products
    .data!.map((p) => ({ p, f: Array.isArray(p.product_forecasts) ? p.product_forecasts[0] : p.product_forecasts }))
    .filter(({ p, f }) => isRunningLow(p, f))
    .map(({ p, f }) => ({
      id: p.id,
      name: p.name,
      daysLeft: f!.days_left === null ? null : Number(f!.days_left),
      orderQty: f!.order_qty,
      flagged: f!.stockout_boost_until !== null,
    }))
    // Same order as the Orders tab: customer-flagged first, then fewest days.
    .sort((a, b) => Number(b.flagged) - Number(a.flagged) || (a.daysLeft ?? 0) - (b.daysLeft ?? 0));

  return {
    productCount: products.data!.length,
    salesPaise: revenue(today.data as Sale[]),
    unitsSold: today.data!.reduce((n, s) => n + s.qty, 0),
    lastWeekPaise: revenue(lastWeek.data as Sale[]),
    low: low.slice(0, 3),
    lowCount: low.length,
    reviews: reviews.data!.slice(0, 2).map((r) => ({ id: r.id, sentiment: r.sentiment, summary: r.summary, createdAt: r.created_at })),
    newReviews: reviews.data!.length,
  };
}
