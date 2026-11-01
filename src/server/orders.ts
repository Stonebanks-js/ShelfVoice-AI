import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { after } from "next/server";
import webpush from "web-push";
import { z } from "zod";

import { env } from "@/env/server";
import { deliveryFee, distanceKm } from "@/lib/delivery";
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
    // Where to deliver, when the shop delivers only within a distance (V-05).
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
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
export async function placeOrder(slug: string, order: NewOrder, ipHash: string, requestId: string, customerId: string | null = null) {
  const phone = toE164(order.phone);
  if (!phone) throw new ApiError(422, "BAD_PHONE", "Please check the phone number");
  if (order.fulfilment === "DELIVERY" && !order.address?.trim()) throw new ApiError(422, "ADDRESS_NEEDED", "Add your address for delivery");

  const db = adminClient();
  const { data: shop } = await db
    .from("shops")
    .select("id, name, is_published, is_demo, delivers, lat, lng, delivery_min_paise, delivery_fee_paise, free_delivery_above_paise, delivery_radius_km")
    .eq("slug", slug)
    .maybeSingle();
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

  // Delivery rules (V-05): minimum order, charge (free above an amount) and
  // distance, measured from the shop to where the customer wants it.
  let fee = 0;
  if (order.fulfilment === "DELIVERY") {
    const subtotal = [...qty.entries()].reduce((sum, [id, n]) => sum + (available.find((p) => p.id === id)!.price_paise ?? 0) * n, 0);
    const rules = {
      minPaise: shop.delivery_min_paise,
      feePaise: shop.delivery_fee_paise,
      freeAbovePaise: shop.free_delivery_above_paise,
      radiusKm: shop.delivery_radius_km === null ? null : Number(shop.delivery_radius_km),
    };
    const charge = deliveryFee(rules, subtotal);
    if (charge === "BELOW_MINIMUM") throw new ApiError(422, "BELOW_MINIMUM", "This order is below the shop's minimum for delivery");
    if (rules.radiusKm && shop.lat !== null && shop.lng !== null) {
      if (order.lat == null || order.lng == null) throw new ApiError(422, "LOCATION_NEEDED", "Share where to deliver, so the shop can check the distance");
      if (distanceKm({ lat: shop.lat, lng: shop.lng }, { lat: order.lat, lng: order.lng }) > rules.radiusKm) {
        throw new ApiError(422, "OUT_OF_RANGE", "This shop doesn't deliver that far; choose pickup");
      }
    }
    fee = charge;
  }

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
      customer_id: customerId,
      delivery_fee_paise: fee,
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
  deliveryFeePaise: number;
  shop: { name: string; slug: string; phone: string | null; language: string; upiId: string | null; acceptsCash: boolean; payOnDelivery: boolean };
  items: Array<{ name: string; unit: string | null; pricePaise: number | null; qty: number; status: ItemStatus }>;
  refunds: Array<{ amountPaise: number; reason: string; createdAt: string }>;
}

// The customer's view of their order, from the secret link, or for the
// signed-in customer who placed it (V-05).
export async function orderForCustomer(id: string, token: string, userId: string | null = null): Promise<OrderView | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const tokenOk = /^[A-Za-z0-9_-]{20,64}$/.test(token);
  if (!tokenOk && !userId) return null;
  const db = adminClient();
  const { data } = await db
    .from("orders")
    .select(
      "id, code, status, fulfilment, created_at, updated_at, token_hash, customer_id, delivery_fee_paise, shops(name, slug, phone, language, upi_id, accepts_cash, pay_on_delivery), order_items(name, unit, price_paise, qty, status, position), order_refunds(amount_paise, reason, created_at)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const byToken = tokenOk && timingSafeEqual(Buffer.from(hash(token)), Buffer.from(data.token_hash));
  if (!byToken && !(userId && data.customer_id === userId)) return null;
  const shop = Array.isArray(data.shops) ? data.shops[0] : data.shops;
  return {
    id: data.id,
    code: data.code,
    status: data.status,
    fulfilment: data.fulfilment,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    deliveryFeePaise: data.delivery_fee_paise,
    shop: {
      name: shop!.name,
      slug: shop!.slug,
      phone: shop!.phone,
      language: shop!.language,
      upiId: shop!.upi_id,
      acceptsCash: shop!.accepts_cash,
      payOnDelivery: shop!.pay_on_delivery,
    },
    items: [...data.order_items]
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ name: i.name, unit: i.unit, pricePaise: i.price_paise, qty: i.qty, status: i.status })),
    refunds: data.order_refunds.map((r) => ({ amountPaise: r.amount_paise, reason: r.reason, createdAt: r.created_at })),
  };
}

// What the customer owes for an order: the items the shop has, plus the
// delivery charge, less refunds.
export function orderTotal(order: Pick<OrderView, "items" | "deliveryFeePaise" | "refunds" | "status">): { itemsPaise: number; duePaise: number } {
  if (order.status === "CANCELLED") return { itemsPaise: 0, duePaise: 0 };
  const itemsPaise = order.items.filter((i) => i.status !== "UNAVAILABLE").reduce((sum, i) => sum + (i.pricePaise ?? 0) * i.qty, 0);
  const refunded = order.refunds.reduce((sum, r) => sum + r.amountPaise, 0);
  return { itemsPaise, duePaise: Math.max(0, itemsPaise + order.deliveryFeePaise - refunded) };
}

// A refund the owner records on a finished or cancelled order (V-05): how
// much and why. Never more than the order came to, all refunds together.
export const Refund = z.object({ amount_paise: z.number().int().min(1).max(10_000_000), reason: z.string().trim().min(1).max(200) }).strict();

export async function addRefund(ctx: Ctx, orderId: string, refund: z.infer<typeof Refund>) {
  const { data: order } = await ctx.db
    .from("orders")
    .select("id, status, delivery_fee_paise, order_items(price_paise, qty, status), order_refunds(amount_paise)")
    .eq("id", orderId)
    .eq("shop_id", ctx.shop.id)
    .maybeSingle();
  if (!order) throw new ApiError(404, "NOT_FOUND", "Order not found");
  if (order.status !== "COMPLETED" && order.status !== "CANCELLED") throw new ApiError(409, "ORDER_OPEN", "Refunds are for finished orders");
  const paid = order.order_items.filter((i) => i.status !== "UNAVAILABLE").reduce((sum, i) => sum + (i.price_paise ?? 0) * i.qty, 0) + order.delivery_fee_paise;
  const refunded = order.order_refunds.reduce((sum, r) => sum + r.amount_paise, 0);
  if (refunded + refund.amount_paise > paid) throw new ApiError(422, "REFUND_TOO_BIG", "That's more than this order came to");
  const { error } = await adminClient().from("order_refunds").insert({ order_id: orderId, shop_id: ctx.shop.id, amount_paise: refund.amount_paise, reason: refund.reason });
  if (error) throw fromPostgres(error);
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
