import "server-only";

import { randomBytes } from "node:crypto";

import { refreshForecasts } from "@/server/forecast/refresh";
import { adminClient } from "@/server/supabase";

import { DEMO_PRODUCTS, DEMO_SHOP, simulateHistory } from "./template";

const DEMO_TTL_HOURS = 24;
const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000;

// Gives one anonymous demo user their own fresh copy of the demo shop (doc 03:
// visitors never change each other's data). Written with the service role,
// because only the server creates demo copies (errata E-29).
export async function createDemoCopy(userId: string, now = new Date(), language: "hi" | "en" = "hi"): Promise<string> {
  const db = adminClient();
  const slug = `demo-${randomBytes(4).toString("hex")}`;

  const { data: shop, error: shopError } = await db
    .from("shops")
    .insert({
      owner_id: userId,
      name: DEMO_SHOP.name,
      slug,
      category: DEMO_SHOP.category,
      address: DEMO_SHOP.address,
      phone: DEMO_SHOP.phone,
      hours: DEMO_SHOP.hours,
      language, // the language the visitor was using on sign-in
      is_published: true,
      is_demo: true,
      demo_expires_at: new Date(now.getTime() + DEMO_TTL_HOURS * 3_600_000).toISOString(),
    })
    .select("id")
    .single();
  if (shopError) throw shopError;

  const { data: products, error: productError } = await db
    .from("products")
    .insert(
      DEMO_PRODUCTS.map((p) => ({
        shop_id: shop.id,
        name: p.name,
        aliases: p.aliases,
        category: p.category,
        unit: p.unit,
        price_paise: p.pricePaise,
        stock_qty: 0,
        is_in_stock: false,
        pack_size: p.packSize ?? 1,
      })),
    )
    .select("id, name");
  if (productError) throw productError;
  const idByIndex = DEMO_PRODUCTS.map((p) => products.find((row) => row.name === p.name)!.id);

  // Movements in time order; the stock trigger applies each one. Days are
  // India days (8 am deliveries, 6 pm sales); today's never run past now.
  const todayStart = Math.floor((now.getTime() + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;
  const start = todayStart - 89 * DAY_MS;
  const rows = simulateHistory().map((m, i) => ({
    shop_id: shop.id,
    product_id: idByIndex[m.productIndex],
    kind: m.kind,
    qty: m.qty,
    source: "SEED" as const,
    occurred_at: new Date(Math.min(start + m.day * DAY_MS + (m.kind === "DELIVERY" ? 8 : 18) * 3_600_000, now.getTime())).toISOString(),
    idempotency_key: `seed:${i}`,
  }));
  rows.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("stock_movements").insert(rows.slice(i, i + 500));
    if (error) throw error;
  }

  // Two analysed reviews, one flagging atta as out of stock (doc 01 story 6).
  const atta = idByIndex[DEMO_PRODUCTS.findIndex((p) => p.name === "Aashirvaad Atta")];
  const maggi = idByIndex[DEMO_PRODUCTS.findIndex((p) => p.name.startsWith("Maggi"))];
  const { error: reviewError } = await db.from("reviews").insert([
    {
      shop_id: shop.id,
      transcript: "Kal atta lene aaya tha, khatam tha. Jaldi mangwa lo.",
      status: "ANALYZED",
      sentiment: "NEGATIVE",
      summary: "Atta was out of stock yesterday.",
      mentioned_product_ids: [atta],
      stockout_product_ids: [atta],
      consent_at: new Date(now.getTime() - 3 * 3_600_000).toISOString(),
      created_at: new Date(now.getTime() - 3 * 3_600_000).toISOString(),
    },
    {
      shop_id: shop.id,
      transcript: "Bhaiya bahut achhe hain, Maggi hamesha milti hai.",
      status: "ANALYZED",
      sentiment: "POSITIVE",
      summary: "Happy with the service; Maggi is always available.",
      mentioned_product_ids: [maggi],
      stockout_product_ids: [],
      consent_at: new Date(now.getTime() - 26 * 3_600_000).toISOString(),
      created_at: new Date(now.getTime() - 26 * 3_600_000).toISOString(),
    },
  ]);
  if (reviewError) throw reviewError;

  // Forecasts ready before the visitor opens the order list.
  await refreshForecasts(shop.id, undefined, now);
  return shop.id;
}
