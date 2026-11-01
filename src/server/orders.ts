import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { after } from "next/server";
import webpush from "web-push";
import { z } from "zod";

import { env } from "@/env/server";
import { toE164 } from "@/server/changes";
import { ApiError, fromPostgres } from "@/server/http";
import { log } from "@/server/log";
import type { Owner, Shop } from "@/server/owner";
import { adminClient } from "@/server/supabase";
import type { Database } from "@/types/database";

type Ctx = Owner & { shop: Shop; requestId: string };
export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type ItemStatus = Database["public"]["Enums"]["order_item_status"];

// What a customer sends from the cart (V-04). Prices and names come from the
// shop's own products, never from the request.
export const NewOrder = z
  .object({
    name: z.string().trim().min(1).max(60),
    phone: z.string().trim().min(6).max(20),
    fulfilment: z.enum(["PICKUP", "DELIVERY"]),
    address: z.string().trim().max(300).nullable().optional(),
    note: z.string().trim().max(300).nullable().optional(),
    items: z
      .array(z.object({ productId: z.uuid(), qty: z.number().int().min(1).max(99) }).strict())
      .min(1)
      .max(50),
  })
  .strict();
export type NewOrder = z.infer<typeof NewOrder>;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L

function orderCode(): string {
  return [...randomBytes(4)].map((b) => CODE_LETTERS[b % CODE_LETTERS.length]).join("");
}

// ------------------------------------------------------------------ customer
// Places an order for a published shop. Returns the secret link token, which
// is the customer's only way back to it (only its hash is stored).
export async function placeOrder(slug: string, order: NewOrder, ipHash: string, requestId: string) {
  const phone = toE164(order.phone);
  if (!phone) throw new ApiError(422, "BAD_PHONE", "Please check the phone number");
  if (order.fulfilment === "DELIVERY" && !order.address?.trim()) throw new ApiError(422, "ADDRESS_NEEDED", "Add your address for delivery");

  const db = adminClient();
  const { data: shop } = await db.from("shops").select("id, name, is_published, is_demo, delivers").eq("slug", slug).maybeSingle();
  if (!shop?.is_published || shop.is_demo) throw new ApiError(404, "NOT_FOUND", "This shop isn't online right now");
  if (order.fulfilment === "DELIVERY" && !shop.delivers) throw new ApiError(422, "NO_DELIVERY", "This shop doesn't deliver; choose pickup");

  // The same product twice in a cart counts once, with the quantities added.
  const qty = new Map<string, number>();
  for (const item of order.items) qty.set(item.productId, Math.min(99, (qty.get(item.productId) ?? 0) + item.qty));
  const { data: products, error: productError } = await db
    .from("products")
    .select("id, name, unit, price_paise, is_in_stock")
    .eq("shop_id", shop.id)
    .eq("is_published", true)
    .is("archived_at", null)
    .in("id", [...qty.keys()]);
  if (productError) throw fromPostgres(productError);
  const available = products.filter((p) => p.is_in_stock);
  if (available.length !== qty.size) throw new ApiError(409, "ITEMS_CHANGED", "Some items are no longer available; please check your cart");

  const token = randomBytes(24).toString("base64url");
  const { data: created, error } = await db
    .from("orders")
    .insert({
      shop_id: shop.id,
      code: orderCode(),
      customer_name: order.name,
      customer_phone: phone,
      fulfilment: order.fulfilment,
      address: order.fulfilment === "DELIVERY" ? order.address!.trim() : null,
      note: order.note?.trim() || null,
      token_hash: hash(token),
      ip_hash: ipHash,
    })
    .select("id, code")
    .single();
  if (error) throw fromPostgres(error);

  const ordered = [...qty.entries()].map(([id, n]) => ({ product: available.find((p) => p.id === id)!, n }));
  const { error: itemError } = await db.from("order_items").insert(
    ordered.map(({ product, n }, position) => ({
      order_id: created.id,
      shop_id: shop.id,
      product_id: product.id,
      name: product.name,
      unit: product.unit,
      price_paise: product.price_paise,
      qty: n,
      position,
    })),
  );
  if (itemError) {
    await db.from("orders").delete().eq("id", created.id);
    throw fromPostgres(itemError);
  }

  const items = ordered.reduce((sum, { n }) => sum + n, 0);
  after(() => notifyShop(shop.id, { code: created.code, name: order.name, items, requestId }));
  log("info", "order.placed", { requestId, shopId: shop.id, orderId: created.id, items });
  return { id: created.id, code: created.code, token };
}

export interface OrderView {
  id: string;
  code: string;
  status: OrderStatus;
  fulfilment: "PICKUP" | "DELIVERY";
  createdAt: string;
  updatedAt: string;
  shop: { name: string; slug: string; phone: string | null; language: string };
  items: Array<{ name: string; unit: string | null; pricePaise: number | null; qty: number; status: ItemStatus }>;
}

// The customer's view of their order, from the secret link.
export async function orderForCustomer(id: string, token: string): Promise<OrderView | null> {
  if (!z.uuid().safeParse(id).success || !/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const db = adminClient();
  const { data } = await db
    .from("orders")
    .select("id, code, status, fulfilment, created_at, updated_at, token_hash, shops(name, slug, phone, language), order_items(name, unit, price_paise, qty, status, position)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const given = Buffer.from(hash(token));
  if (!timingSafeEqual(given, Buffer.from(data.token_hash))) return null;
  const shop = Array.isArray(data.shops) ? data.shops[0] : data.shops;
  return {
    id: data.id,
    code: data.code,
    status: data.status,
    fulfilment: data.fulfilment,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    shop: { name: shop!.name, slug: shop!.slug, phone: shop!.phone, language: shop!.language },
    items: [...data.order_items]
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ name: i.name, unit: i.unit, pricePaise: i.price_paise, qty: i.qty, status: i.status })),
  };
}

// --------------------------------------------------------------------- owner
// Which way an order may move from each status (doc: V-04).
const NEXT: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["READY", "COMPLETED", "CANCELLED"],
  READY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export async function setOrderStatus(ctx: Ctx, id: string, status: OrderStatus) {
  const { data: order } = await ctx.db.from("orders").select("id, status").eq("id", id).eq("shop_id", ctx.shop.id).maybeSingle();
  if (!order) throw new ApiError(404, "NOT_FOUND", "Order not found");
  if (!NEXT[order.status].includes(status)) throw new ApiError(409, "ORDER_NOT_OPEN", "This order has already moved on");

  if (status === "ACCEPTED") {
    // Accepting says yes to every item the owner hasn't marked unavailable.
    const { error } = await ctx.db.from("order_items").update({ status: "AVAILABLE" }).eq("order_id", id).eq("status", "PENDING");
    if (error) throw fromPostgres(error);
  }
  if (status === "COMPLETED") {
    const { error } = await ctx.db.rpc("complete_order", { p_order_id: id });
    if (error) {
      if (error.hint === "STOCK_NEGATIVE") throw new ApiError(409, "STOCK_NEGATIVE", "Stock would go below zero; correct the count first");
      throw fromPostgres(error);
    }
    return;
  }
  const { error } = await ctx.db.from("orders").update({ status }).eq("id", id).eq("status", order.status);
  if (error) throw fromPostgres(error);
}

export async function setItemStatus(ctx: Ctx, orderId: string, itemId: string, status: "AVAILABLE" | "UNAVAILABLE") {
  const { data: order } = await ctx.db.from("orders").select("status").eq("id", orderId).eq("shop_id", ctx.shop.id).maybeSingle();
  if (!order) throw new ApiError(404, "NOT_FOUND", "Order not found");
  if (order.status !== "NEW" && order.status !== "ACCEPTED") throw new ApiError(409, "ORDER_NOT_OPEN", "This order has already moved on");
  const { data, error } = await ctx.db.from("order_items").update({ status }).eq("id", itemId).eq("order_id", orderId).select("id").maybeSingle();
  if (error) throw fromPostgres(error);
  if (!data) throw new ApiError(404, "NOT_FOUND", "Item not found");
}

// ---------------------------------------------------------------- web push
export const pushEnabled = () => Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

export const PushSubscription = z
  .object({
    endpoint: z.url().startsWith("https://").max(1000),
    keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }).strict(),
  })
  .strict();

export async function savePushSubscription(ctx: Ctx, subscription: z.infer<typeof PushSubscription>) {
  const { error } = await adminClient()
    .from("push_subscriptions")
    .upsert({ shop_id: ctx.shop.id, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth }, { onConflict: "endpoint" });
  if (error) throw fromPostgres(error);
}

export async function removePushSubscription(ctx: Ctx, endpoint: string) {
  const { error } = await adminClient().from("push_subscriptions").delete().eq("shop_id", ctx.shop.id).eq("endpoint", endpoint);
  if (error) throw fromPostgres(error);
}

// A notification on each of the owner's phones that asked for one. Phones
// that have unsubscribed (404 or 410) are forgotten. Never fails the order.
async function notifyShop(shopId: string, order: { code: string; name: string; items: number; requestId: string }) {
  if (!pushEnabled()) return;
  try {
    const db = adminClient();
    const [{ data: subs }, { data: shop }] = await Promise.all([
      db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("shop_id", shopId),
      db.from("shops").select("language").eq("id", shopId).single(),
    ]);
    if (!subs?.length) return;
    const hi = shop?.language !== "en";
    const payload = JSON.stringify({
      title: hi ? `नया ऑर्डर ${order.code}` : `New order ${order.code}`,
      body: hi ? `${order.name}: ${order.items} सामान` : `${order.name}: ${order.items} ${order.items === 1 ? "item" : "items"}`,
      url: "/app/orders",
    });
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
            vapidDetails: { subject: "https://shelfvoice.vercel.app", publicKey: env.VAPID_PUBLIC_KEY!, privateKey: env.VAPID_PRIVATE_KEY! },
            TTL: 3600,
            urgency: "high",
          });
        } catch (failure) {
          const status = (failure as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("id", sub.id);
          else log("warn", "push.failed", { requestId: order.requestId, shopId, status });
        }
      }),
    );
  } catch (failure) {
    log("error", "push.notify_failed", { requestId: order.requestId, shopId, error: failure });
  }
}
