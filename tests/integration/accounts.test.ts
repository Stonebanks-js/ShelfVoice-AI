// Customer accounts, delivery rules and refunds (V-05) against the local
// database. Needs `supabase start`.
import { describe, expect, it, vi } from "vitest";

import { admin, testOwner } from "./helpers";

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => Promise<void>) => void task(),
}));

const customer = await import("@/server/customer");
const { placeOrder, setOrderStatus, addRefund, orderForCustomer } = await import("@/server/orders");

// A published shop with two products; its owner context.
async function shop(fields: Record<string, unknown> = {}) {
  const owner = await testOwner();
  await admin.from("shops").update({ is_published: true, ...fields }).eq("id", owner.shop.id);
  const { data } = await admin
    .from("products")
    .insert([
      { shop_id: owner.shop.id, name: "Atta", unit: "5 kg", price_paise: 29_000, stock_qty: null, is_in_stock: true },
      { shop_id: owner.shop.id, name: "Salt", unit: "1 kg", price_paise: 2_800, stock_qty: null, is_in_stock: true },
    ])
    .select("id, name");
  return { owner, atta: data!.find((p) => p.name === "Atta")!.id, salt: data!.find((p) => p.name === "Salt")!.id };
}

// A signed-in person with no shop: a customer.
const person = async () => {
  const user = await testOwner(false);
  return { db: user.db, user: user.user };
};

describe("a customer's account", () => {
  it("keeps details, one default address, and only their own rows", async () => {
    const me = await person();
    await customer.saveProfile(me, { name: "Sunita", phone: "98765 00011", pay_with: "UPI" });
    const home = await customer.saveAddress(me, { label: "Home", address: "4 Gali 2", pincode: "250004" });
    const office = await customer.saveAddress(me, { label: "Office", address: "Station Road", is_default: true });
    let account = await customer.getAccount(me);
    expect(account.profile).toEqual({ name: "Sunita", phone: "+919876500011", pay_with: "UPI" });
    expect(account.addresses.map((a) => [a.label, a.is_default])).toEqual([
      ["Office", true],
      ["Home", false],
    ]);
    await customer.deleteAddress(me, office);
    account = await customer.getAccount(me);
    expect(account.addresses.map((a) => a.id)).toEqual([home]);

    // Another person sees none of it, and can't change it.
    const other = await person();
    expect((await other.db.from("customers").select("user_id").eq("user_id", me.user.id)).data).toEqual([]);
    expect((await other.db.from("customer_addresses").select("id").eq("id", home)).data).toEqual([]);
    await other.db.from("customer_addresses").update({ address: "Somewhere else" }).eq("id", home);
    expect((await customer.getAccount(me)).addresses[0].address).toBe("4 Gali 2");
    await expect(customer.saveProfile(me, { name: null, phone: "123", pay_with: "CASH" })).rejects.toMatchObject({ code: "BAD_PHONE" });
  });

  it("saves only published products and shops to the wishlist", async () => {
    const me = await person();
    const { owner, atta } = await shop();
    await customer.setWishlisted(me, atta, true);
    await customer.setFavourite(me, owner.shop.slug, true);
    let account = await customer.getAccount(me);
    expect(account.wishlist).toMatchObject([{ productId: atta, name: "Atta", slug: owner.shop.slug }]);
    expect(account.favourites).toMatchObject([{ slug: owner.shop.slug }]);

    // Hidden shops drop out of the lists, and can't be added.
    await admin.from("shops").update({ is_published: false }).eq("id", owner.shop.id);
    account = await customer.getAccount(me);
    expect(account.wishlist).toEqual([]);
    expect(account.favourites).toEqual([]);
    await expect(customer.setFavourite(me, owner.shop.slug, true)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lists the customer's orders and refunds, and opens them without the link", async () => {
    const me = await person();
    const { owner, atta } = await shop();
    const placed = await placeOrder(owner.shop.slug, { name: "Sunita", phone: "9876500011", fulfilment: "PICKUP", items: [{ productId: atta, qty: 1 }] }, "ip", "req", me.user.id);
    await setOrderStatus(owner, placed.id, "ACCEPTED");
    await setOrderStatus(owner, placed.id, "COMPLETED");
    await addRefund(owner, placed.id, { amount_paise: 5_000, reason: "Torn bag" });
    await expect(addRefund(owner, placed.id, { amount_paise: 25_000, reason: "Too much" })).rejects.toMatchObject({ code: "REFUND_TOO_BIG" });

    const account = await customer.getAccount(me);
    expect(account.orders).toMatchObject([{ id: placed.id, status: "COMPLETED", shop: owner.shop.name, refunds: [{ amountPaise: 5_000, reason: "Torn bag" }] }]);
    expect(await orderForCustomer(placed.id, "", me.user.id)).toMatchObject({ code: placed.code, refunds: [{ amountPaise: 5_000 }] });
    expect(await orderForCustomer(placed.id, "", (await person()).user.id)).toBeNull();
  });

  it("deletes a customer's account, keeping a shop owner's sign-in", async () => {
    const me = await person();
    await customer.saveAddress(me, { label: "Home", address: "4 Gali 2" });
    expect(await customer.deleteCustomer(me)).toEqual({ signedOut: true });
    expect((await admin.auth.admin.getUserById(me.user.id)).data.user).toBeNull();

    const { owner } = await shop();
    await customer.saveProfile(owner, { name: "Owner", phone: null, pay_with: "CASH" });
    expect(await customer.deleteCustomer(owner)).toEqual({ signedOut: false });
    expect((await admin.from("customers").select("user_id").eq("user_id", owner.user.id)).data).toEqual([]);
    expect((await admin.from("shops").select("id").eq("id", owner.shop.id)).data).toHaveLength(1);
  });
});

describe("delivery rules", () => {
  const rules = { delivers: true, delivery_min_paise: 20_000, delivery_fee_paise: 2_000, free_delivery_above_paise: 50_000, delivery_radius_km: 3, lat: 28.98, lng: 77.7 };
  const deliver = (items: Array<{ productId: string; qty: number }>, more: Record<string, unknown> = {}) => ({
    name: "Sunita",
    phone: "9876500011",
    fulfilment: "DELIVERY" as const,
    address: "4 Gali 2",
    lat: 28.99,
    lng: 77.7,
    items,
    ...more,
  });

  it("refuses small orders, charges the fee, and delivers free above the amount", async () => {
    const { owner, atta, salt } = await shop(rules);
    await expect(placeOrder(owner.shop.slug, deliver([{ productId: salt, qty: 1 }]), "ip", "req")).rejects.toMatchObject({ code: "BELOW_MINIMUM" });
    const one = await placeOrder(owner.shop.slug, deliver([{ productId: atta, qty: 1 }]), "ip", "req");
    const two = await placeOrder(owner.shop.slug, deliver([{ productId: atta, qty: 2 }]), "ip", "req");
    const fees = await admin.from("orders").select("id, delivery_fee_paise").in("id", [one.id, two.id]);
    expect(Object.fromEntries(fees.data!.map((o) => [o.id, o.delivery_fee_paise]))).toEqual({ [one.id]: 2_000, [two.id]: 0 });
    // Pickup ignores every delivery rule.
    await expect(placeOrder(owner.shop.slug, { ...deliver([{ productId: salt, qty: 1 }]), fulfilment: "PICKUP" }, "ip", "req")).resolves.toBeTruthy();
  });

  it("delivers only within the distance, and needs to know where", async () => {
    const { owner, atta } = await shop(rules);
    await expect(placeOrder(owner.shop.slug, deliver([{ productId: atta, qty: 1 }], { lat: null, lng: null }), "ip", "req")).rejects.toMatchObject({ code: "LOCATION_NEEDED" });
    await expect(placeOrder(owner.shop.slug, deliver([{ productId: atta, qty: 1 }], { lat: 29.05, lng: 77.7 }), "ip", "req")).rejects.toMatchObject({ code: "OUT_OF_RANGE" });
  });

  it("shows the UPI ID and payment modes on the order", async () => {
    const { owner, atta } = await shop({ upi_id: "sharmastore@okaxis", pay_on_delivery: false });
    const placed = await placeOrder(owner.shop.slug, { name: "R", phone: "9876500011", fulfilment: "PICKUP", items: [{ productId: atta, qty: 1 }] }, "ip", "req");
    expect((await orderForCustomer(placed.id, placed.token))!.shop).toMatchObject({ upiId: "sharmastore@okaxis", acceptsCash: true, payOnDelivery: false });
  });
});
