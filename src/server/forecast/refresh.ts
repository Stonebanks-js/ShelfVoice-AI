import "server-only";

import { adminClient } from "@/server/supabase";

import { FORECAST, forecast } from "./formula";

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000;

// Day number in India time, so "today" matches the owner's day.
const istDay = (t: Date | string) => Math.floor((new Date(t).getTime() + IST_OFFSET_MS) / DAY_MS);
const istDate = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

// Recomputes forecasts for a shop, or just some of its products, and stores
// them in product_forecasts (doc 02: after each logged sale, and nightly).
// Runs with the service role because owners only read forecasts (E-29).
export async function refreshForecasts(shopId: string, productIds?: string[], now = new Date()): Promise<number> {
  const db = adminClient();
  const today = istDay(now);
  const since = new Date((today - 89) * DAY_MS - IST_OFFSET_MS).toISOString();

  const [shopRes, productsRes, reviewsRes, festivalsRes] = await Promise.all([
    db.from("shops").select("lead_time_days, review_period_days").eq("id", shopId).single(),
    (() => {
      let q = db.from("products").select("id, category, stock_qty, pack_size, low_stock_level, created_at").eq("shop_id", shopId).is("archived_at", null);
      if (productIds?.length) q = q.in("id", productIds);
      return q;
    })(),
    db
      .from("reviews")
      .select("stockout_product_ids, created_at")
      .eq("shop_id", shopId)
      .gte("created_at", new Date(now.getTime() - FORECAST.stockoutBoostDays * DAY_MS).toISOString()),
    db
      .from("festival_calendar")
      .select("starts_on, ends_on, factor, categories")
      .lte("starts_on", istDate(today + 7))
      .gte("ends_on", istDate(today)),
  ]);
  for (const r of [shopRes, productsRes, reviewsRes, festivalsRes]) if (r.error) throw r.error;
  const shop = shopRes.data!;
  const products = productsRes.data!;
  if (products.length === 0) return 0;

  const ids = products.map((p) => p.id);
  const movements: Array<{ product_id: string; kind: string; qty: number; occurred_at: string }> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("stock_movements")
      .select("product_id, kind, qty, occurred_at")
      .eq("shop_id", shopId)
      .in("product_id", ids)
      .gte("occurred_at", since)
      .order("occurred_at")
      .range(from, from + 999);
    if (error) throw error;
    movements.push(...data);
    if (data.length < 1000) break;
  }

  // Latest review that flagged each product, for the 14-day boost.
  const flaggedUntil = new Map<string, number>();
  for (const review of reviewsRes.data!) {
    const until = istDay(review.created_at) + FORECAST.stockoutBoostDays;
    for (const id of review.stockout_product_ids) flaggedUntil.set(id, Math.max(flaggedUntil.get(id) ?? 0, until));
  }

  const rows = products.map((product) => {
    const mine = movements.filter((m) => m.product_id === product.id);
    const firstDay = Math.min(istDay(product.created_at), ...mine.map((m) => istDay(m.occurred_at)));
    const startDay = Math.max(firstDay, today - 89);
    const dailySales = Array.from({ length: today - startDay + 1 }, () => 0);
    for (const m of mine) {
      // A sale dated after today (device clock ahead) counts from tomorrow.
      const i = istDay(m.occurred_at) - startDay;
      if (m.kind === "SALE" && i < dailySales.length) dailySales[i] += m.qty;
    }

    const festivalFactor = Math.max(
      1,
      ...festivalsRes.data!
        .filter((f) => f.categories.length === 0 || (product.category !== null && f.categories.includes(product.category)))
        .map((f) => Number(f.factor)),
    );
    const boostUntil = flaggedUntil.get(product.id);
    const f = forecast({
      dailySales,
      historyDays: today - firstDay,
      stock: product.stock_qty,
      leadTimeDays: shop.lead_time_days,
      reviewPeriodDays: shop.review_period_days,
      packSize: product.pack_size,
      lowStockLevel: product.low_stock_level,
      festivalFactor,
      stockoutFlagged: boostUntil !== undefined && boostUntil >= today,
    });
    return {
      product_id: product.id,
      shop_id: shopId,
      level: Number(f.level.toFixed(4)),
      sigma: Number(f.sigma.toFixed(4)),
      days_left: f.daysLeft === null ? null : Number(f.daysLeft.toFixed(2)),
      reorder_point: f.reorderPoint === null ? null : Math.ceil(f.reorderPoint),
      order_qty: f.needsReorder ? f.orderQty : 0,
      stockout_boost_until: boostUntil !== undefined && boostUntil >= today ? istDate(boostUntil) : null,
      computed_at: now.toISOString(),
    };
  });

  const { error } = await db.from("product_forecasts").upsert(rows, { onConflict: "product_id" });
  if (error) throw error;
  return rows.length;
}
