// Customer orders against the local database: placing, the secret
// link, the owner's steps, sales logged on completion, and who can see what.
// Needs `supabase start`.
import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { admin, testOwner } from "./helpers";

// Outside a Next request there is no after(); the push is off in tests anyway.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => Promise<void>) => void task(),
}));

const { placeOrder, orderForCustomer, setOrderStatus, setItemStatus } = await import("@/server/orders");
const { runCleanup } = await import("@/server/cleanup");

async function shopWithProducts(fields: Record<string, unknown> = {}) {
  const owner = await testOwner();
  await admin.from("shops").update({ is_published: true, ...fields }).eq("id", owner.shop.id);
  const { data } = await admin
    .from("products")
    .insert([
      { shop_id: owner.shop.id, name: "Maggi", unit: "70 g", price_paise: 1400, stock_qty: 10, is_in_stock: true },
      { shop_id: owner.shop.id, name: "Parle-G", unit: "80 g", price_paise: 1000, stock_qty: null, is_in_stock: true },
      { shop_id: owner.shop.id, name: "Bread", unit: "400 g", price_paise: 4500, stock_qty: 0, is_in_stock: false },
    ])
    .select("id, name");
  const id = (name: string) => data!.find((p) => p.name === name)!.id;
  return { owner, maggi: id("Maggi"), parle: id("Parle-G"), bread: id("Bread") };
}

const order = (items: Array<{ productId: string; qty: number }>, more: Record<string, unknown> = {}) => ({
  name: "Ramesh",
  phone: "98765 43210",
  fulfilment: "PICKUP" as const,
  items,
  ...more,
});

describe("placing an order", () => {
  it("snapshots the shop's own names and prices, merging repeats", async () => {
    const { owner, maggi, parle } = await shopWithProducts();
    const placed = await placeOrder(owner.shop.slug, order([{ productId: maggi, qty: 1 }, { productId: parle, qty: 3 }, { productId: maggi, qty: 1 }]), "ip", "req");
    expect(placed.code).toMatch(/^[A-Z0-9]{4}$/);
    const { data } = await admin.from("orders").select("customer_phone, status, token_hash, order_items(name, price_paise, qty, status)").eq("id", placed.id).single();
    expect(data).toMatchObject({ customer_phone: "+919876543210", status: "NEW" });
    expect(data!.token_hash).not.toContain(placed.token);
    expect(data!.order_items.sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: "Maggi", price_paise: 1400, qty: 2, status: "PENDING" },
      { name: "Parle-G", price_paise: 1000, qty: 3, status: "PENDING" },
    ]);
  });

  it("refuses what the customer can't order", async () => {
    const { owner, maggi, bread } = await shopWithProducts();
    const other = await shopWithProducts();
    const slug = owner.shop.slug;
    await expect(placeOrder(slug, order([{ productId: bread, qty: 1 }]), "ip", "req")).rejects.toMatchObject({ code: "ITEMS_CHANGED" });
    await expect(placeOrder(slug, order([{ productId: other.maggi, qty: 1 }]), "ip", "req")).rejects.toMatchObject({ code: "ITEMS_CHANGED" });
    await expect(placeOrder(slug, order([{ productId: maggi, qty: 1 }], { phone: "12345" }), "ip", "req")).rejects.toMatchObject({ code: "BAD_PHONE" });
    await expect(placeOrder(slug, order([{ productId: maggi, qty: 1 }], { fulfilment: "DELIVERY", address: "Main road" }), "ip", "req")).rejects.toMatchObject({
      code: "NO_DELIVERY",
    });
    await admin.from("shops").update({ is_published: false }).eq("id", owner.shop.id);
    await expect(placeOrder(slug, order([{ productId: maggi, qty: 1 }]), "ip", "req")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("takes home delivery with an address when the shop delivers", async () => {
    const { owner, maggi } = await shopWithProducts({ delivers: true });
    await expect(placeOrder(owner.shop.slug, order([{ productId: maggi, qty: 1 }], { fulfilment: "DELIVERY" }), "ip", "req")).rejects.toMatchObject({
      code: "ADDRESS_NEEDED",
    });
    const placed = await placeOrder(owner.shop.slug, order([{ productId: maggi, qty: 1 }], { fulfilment: "DELIVERY", address: " 12 Main Road " }), "ip", "req");
    const { data } = await admin.from("orders").select("fulfilment, address").eq("id", placed.id).single();
    expect(data).toEqual({ fulfilment: "DELIVERY", address: "12 Main Road" });
  });
});

describe("the customer's link", () => {
  it("opens only with the right token", async () => {
    const { owner, maggi } = await shopWithProducts();
    const placed = await placeOrder(owner.shop.slug, order([{ productId: maggi, qty: 2 }]), "ip", "req");
    const view = await orderForCustomer(placed.id, placed.token);
    expect(view).toMatchObject({ code: placed.code, status: "NEW", shop: { slug: owner.shop.slug }, items: [{ name: "Maggi", qty: 2 }] });
    // One character off; a token that already ends in "x" gets a "y".
    const wrong = `${placed.token.slice(0, -1)}${placed.token.endsWith("x") ? "y" : "x"}`;
    expect(await orderForCustomer(placed.id, wrong)).toBeNull();
    expect(await orderForCustomer(randomUUID(), placed.token)).toBeNull();
    expect(await orderForCustomer("not-an-id", placed.token)).toBeNull();
  });
});

describe("the owner's steps", () => {
  it("accept, mark what's missing, ready, done: sales logged once for what was given", async () => {
    const { owner, maggi, parle } = await shopWithProducts();
    const placed = await placeOrder(owner.shop.slug, order([{ productId: maggi, qty: 2 }, { productId: parle, qty: 1 }]), "ip", "req");
    const { data: items } = await owner.db.from("order_items").select("id, name").eq("order_id", placed.id);
    const parleItem = items!.find((i) => i.name === "Parle-G")!.id;

    await setItemStatus(owner, placed.id, parleItem, "UNAVAILABLE");
    await setOrderStatus(owner, placed.id, "ACCEPTED");
    expect((await orderForCustomer(placed.id, placed.token))!.items.map((i) => i.status).sort()).toEqual(["AVAILABLE", "UNAVAILABLE"]);
    await setOrderStatus(owner, placed.id, "READY");
    await setOrderStatus(owner, placed.id, "COMPLETED");

    const { data: moves } = await admin.from("stock_movements").select("product_id, kind, qty, unit_price_paise, source").eq("shop_id", owner.shop.id);
    expect(moves).toEqual([{ product_id: maggi, kind: "SALE", qty: 2, unit_price_paise: 1400, source: "ORDER" }]);
    const { data: product } = await admin.from("products").select("stock_qty").eq("id", maggi).single();
    expect(product!.stock_qty).toBe(8);

    await expect(setOrderStatus(owner, placed.id, "COMPLETED")).rejects.toMatchObject({ code: "ORDER_NOT_OPEN" });
    await expect(setOrderStatus(owner, placed.id, "CANCELLED")).rejects.toMatchObject({ code: "ORDER_NOT_OPEN" });
    await expect(setItemStatus(owner, placed.id, parleItem, "AVAILABLE")).rejects.toMatchObject({ code: "ORDER_NOT_OPEN" });
  });

  it("can't skip accepting, and cancelling ends the order", async () => {
    const { owner, maggi } = await shopWithProducts();
    const placed = await placeOrder(owner.shop.slug, order([{ productId: maggi, qty: 1 }]), "ip", "req");
    await expect(setOrderStatus(owner, placed.id, "READY")).rejects.toMatchObject({ code: "ORDER_NOT_OPEN" });
    await setOrderStatus(owner, placed.id, "CANCELLED");
    expect((await orderForCustomer(placed.id, placed.token))!.status).toBe("CANCELLED");
  });

  it("refuses to sell more than the counted stock", async () => {
    const { owner, maggi } = await shopWithProducts();
    const placed = await placeOrder(owner.shop.slug, order([{ productId: maggi, qty: 12 }]), "ip", "req");
    await setOrderStatus(owner, placed.id, "ACCEPTED");
    await expect(setOrderStatus(owner, placed.id, "COMPLETED")).rejects.toMatchObject({ code: "STOCK_NEGATIVE" });
  });
});

describe("who sees orders", () => {
  it("only the shop's owner, never another owner or the public", async () => {
    const { owner, maggi } = await shopWithProducts();
    const placed = await placeOrder(owner.shop.slug, order([{ productId: maggi, qty: 1 }]), "ip", "req");
    const other = await testOwner();
    expect((await other.db.from("orders").select("id").eq("id", placed.id)).data).toEqual([]);
    expect((await other.db.from("order_items").select("id").eq("order_id", placed.id)).data).toEqual([]);
    await expect(setOrderStatus(other, placed.id, "ACCEPTED")).rejects.toMatchObject({ code: "NOT_FOUND" });
    const { error } = await other.db.from("orders").update({ status: "CANCELLED" }).eq("id", placed.id);
    expect(error).toBeNull(); // RLS: no row matched
    expect((await orderForCustomer(placed.id, placed.token))!.status).toBe("NEW");
    // Owners can't rewrite what the customer asked for.
    const { error: rewrite } = await owner.db.from("orders").update({ customer_name: "Someone else" }).eq("id", placed.id);
    expect(rewrite?.code).toBe("42501");
  });
});

describe("keeping orders", () => {
  it("deletes orders after 90 days, keeping the sales they logged", { timeout: 120_000 }, async () => {
    const { owner, maggi } = await shopWithProducts();
    const placed = await placeOrder(owner.shop.slug, order([{ productId: maggi, qty: 1 }]), "ip", "req");
    await setOrderStatus(owner, placed.id, "ACCEPTED");
    await setOrderStatus(owner, placed.id, "COMPLETED");
    await admin.from("orders").update({ created_at: new Date(Date.now() - 91 * 86_400_000).toISOString() }).eq("id", placed.id);
    const result = await runCleanup(new Date());
    expect(result.ordersDeleted).toBeGreaterThanOrEqual(1);
    expect((await admin.from("orders").select("id").eq("id", placed.id)).data).toEqual([]);
    expect((await admin.from("stock_movements").select("id").eq("shop_id", owner.shop.id).eq("source", "ORDER")).data).toHaveLength(1);
  });
});
