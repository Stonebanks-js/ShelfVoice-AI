import "server-only";

import { meta } from "./ai";
import { explainRestock, type ExplainInput, templateExplanation } from "./ai/jobs";
import { isRunningLow } from "./forecast/low";
import { fromPostgres } from "./http";
import { background, log } from "./log";
import type { Owner, Shop } from "./owner";
import { adminClient } from "./supabase";

const today = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

export interface RestockItem {
  productId: string;
  name: string;
  unit: string | null;
  stock: number | null;
  lowStockLevel: number;
  daysLeft: number | null;
  orderQty: number | null;
  sellsPerDay: number;
  customerFlagged: boolean;
  coldStart: boolean;
  reason: string;
}

// The order list (doc 01 FR-07, doc 06 O-7): items at or below their reorder
// point, or at the owner's low-stock level during cold start; customer-
// flagged items first, then fewest days left. Missing explanations are
// worded by Muse Spark after the response, cached per item per day; until
// then the template sentence with the same numbers is shown.
export async function restockList({ db, shop, requestId }: Owner & { shop: Shop; requestId: string }): Promise<{ leadTimeDays: number; items: RestockItem[] }> {
  const { data, error } = await db
    .from("products")
    .select("id, name, unit, stock_qty, low_stock_level, product_forecasts(level, days_left, reorder_point, order_qty, stockout_boost_until, festival, explanation, explanation_on)")
    .eq("shop_id", shop.id)
    .is("archived_at", null)
    .not("stock_qty", "is", null);
  if (error) throw fromPostgres(error);


  const language = shop.language === "en" ? "en" : "hi";
  // Items whose explanation still needs wording, by product ID.
  const toExplain = new Map<string, ExplainInput>();
  const items = data
    .map((p) => ({ product: p, f: Array.isArray(p.product_forecasts) ? p.product_forecasts[0] : p.product_forecasts }))
    .filter(({ product, f }) => isRunningLow(product, f))
    .map(({ product, f }) => {
      const input: ExplainInput = {
        productName: product.name,
        orderQty: f!.order_qty ?? 0,
        daysLeft: Number(f!.days_left ?? 0),
        dailyDemand: Number(f!.level),
        stock: product.stock_qty!,
        leadTimeDays: shop.lead_time_days,
        customerFlagged: f!.stockout_boost_until !== null,
        festival: f!.festival,
        language,
      };
      const cached = f!.explanation_on === today() && f!.explanation?.includes(String(input.orderQty)) ? f!.explanation : null;
      if (!cached && f!.reorder_point !== null && input.orderQty > 0) toExplain.set(product.id, input);
      return {
        productId: product.id,
        name: product.name,
        unit: product.unit,
        stock: product.stock_qty,
        lowStockLevel: product.low_stock_level,
        daysLeft: f!.days_left === null ? null : Number(f!.days_left),
        orderQty: f!.order_qty,
        sellsPerDay: Math.round(Number(f!.level) * 10) / 10,
        customerFlagged: input.customerFlagged,
        coldStart: f!.reorder_point === null,
        reason: cached ?? templateExplanation(input),
      };
    })
    .sort((a, b) => Number(b.customerFlagged) - Number(a.customerFlagged) || (a.daysLeft ?? 0) - (b.daysLeft ?? 0));

  // Word missing explanations after responding; cached per item per day.
  if (toExplain.size) {
    background(async () => {
      for (const [productId, input] of toExplain) {
        try {
          const sentence = await explainRestock(meta(), { job: "EXPLANATION", shopId: shop.id, requestId }, input);
          await adminClient()
            .from("product_forecasts")
            .update({ explanation: sentence, explanation_lang: language, explanation_on: today() })
            .eq("product_id", productId);
        } catch (error) {
          log("warn", "restock.explain_failed", { requestId, shopId: shop.id, error });
        }
      }
    });
  }

  return { leadTimeDays: shop.lead_time_days, items };
}
