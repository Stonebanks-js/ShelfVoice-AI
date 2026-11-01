import "server-only";

import { z } from "zod";

import { toE164 } from "@/server/changes";
import { ApiError, fromPostgres } from "@/server/http";
import { Latitude, Longitude, Pincode } from "@/server/location";
import type { Owner } from "@/server/owner";
import { adminClient } from "@/server/supabase";

// A customer's account (V-05, E-36): their details, saved addresses,
// wishlist, favourite shops, orders and refunds. Their own rows are read
// under RLS; what shops publish (product and shop names) is read with the
// service role, only for products and shops that are published.

export const Profile = z
  .object({
    name: z.string().trim().min(1).max(60).nullable(),
    phone: z.string().trim().max(20).nullable(),
    pay_with: z.enum(["CASH", "UPI"]),
  })
  .strict();

export const Address = z
  .object({
    label: z.string().trim().min(1).max(30).default("Home"),
    address: z.string().trim().min(1).max(300),
    pincode: Pincode.nullable().optional(),
    lat: Latitude.nullable().optional(),
    lng: Longitude.nullable().optional(),
    is_default: z.boolean().optional(),
  })
  .strict()
  .refine((a) => (a.lat == null) === (a.lng == null), { message: "Latitude and longitude go together", path: ["lat"] });

export interface Account {
  email: string | null;
  profile: { name: string | null; phone: string | null; pay_with: "CASH" | "UPI" } | null;
  addresses: Array<{ id: string; label: string; address: string; pincode: string | null; lat: number | null; lng: number | null; is_default: boolean }>;
  wishlist: Array<{ productId: string; name: string; unit: string | null; pricePaise: number | null; inStock: boolean; shop: string; slug: string }>;
  favourites: Array<{ shopId: string; name: string; slug: string; category: string | null }>;
  orders: Array<{
    id: string;
    code: string;
    status: string;
    createdAt: string;
    shop: string;
    slug: string;
    items: Array<{ productId: string | null; name: string; qty: number; pricePaise: number | null; status: string }>;
    deliveryFeePaise: number;
    refunds: Array<{ amountPaise: number; reason: string; createdAt: string }>;
  }>;
}

// Creates the customer row on first use, so the other tables can refer to it.
async function ensureCustomer({ db, user }: Owner) {
  const { error } = await db.from("customers").upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
  if (error) throw fromPostgres(error);
}

export async function getAccount({ db, user }: Owner): Promise<Account> {
  const [profile, addresses, wishlist, favourites, orders] = await Promise.all([
    db.from("customers").select("name, phone, pay_with").eq("user_id", user.id).maybeSingle(),
    db.from("customer_addresses").select("id, label, address, pincode, lat, lng, is_default").eq("user_id", user.id).order("is_default", { ascending: false }).order("created_at"),
    db.from("wishlist_items").select("product_id").eq("user_id", user.id).order("created_at", { ascending: false }),
    db.from("favourite_shops").select("shop_id").eq("user_id", user.id).order("created_at", { ascending: false }),
    db
      .from("orders")
      .select("id, code, status, created_at, shop_id, delivery_fee_paise, order_items(product_id, name, qty, price_paise, status, position), order_refunds(amount_paise, reason, created_at)")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  for (const r of [profile, addresses, wishlist, favourites, orders]) if (r.error) throw fromPostgres(r.error);

  // Names of published products and shops, for the wishlist and order lists.
  const admin = adminClient();
  const productIds = wishlist.data!.map((w) => w.product_id);
  const shopIds = [...new Set([...favourites.data!.map((f) => f.shop_id), ...orders.data!.map((o) => o.shop_id)])];
  const [products, shops] = await Promise.all([
    productIds.length
      ? admin.from("products").select("id, name, unit, price_paise, is_in_stock, shop_id, shops!inner(name, slug, is_published)").in("id", productIds).eq("is_published", true).is("archived_at", null)
      : Promise.resolve({ data: [], error: null }),
    shopIds.length ? admin.from("shops").select("id, name, slug, category, is_published").in("id", shopIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (products.error) throw fromPostgres(products.error);
  if (shops.error) throw fromPostgres(shops.error);
  const shopById = new Map((shops.data ?? []).map((s) => [s.id, s]));
  const one = <T,>(value: T | T[]) => (Array.isArray(value) ? value[0] : value);

  return {
    email: user.email ?? null,
    profile: profile.data && { ...profile.data, pay_with: profile.data.pay_with === "UPI" ? "UPI" : "CASH" },
    addresses: addresses.data!,
    wishlist: productIds
      .map((id) => (products.data ?? []).find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p) && Boolean(one(p!.shops)?.is_published))
      .map((p) => ({ productId: p.id, name: p.name, unit: p.unit, pricePaise: p.price_paise, inStock: p.is_in_stock, shop: one(p.shops)!.name, slug: one(p.shops)!.slug })),
    favourites: favourites
      .data!.map((f) => shopById.get(f.shop_id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s?.is_published))
      .map((s) => ({ shopId: s.id, name: s.name, slug: s.slug, category: s.category })),
    orders: orders.data!.map((o) => ({
      id: o.id,
      code: o.code,
      status: o.status,
      createdAt: o.created_at,
      shop: shopById.get(o.shop_id)?.name ?? "",
      slug: shopById.get(o.shop_id)?.slug ?? "",
      deliveryFeePaise: o.delivery_fee_paise,
      items: [...o.order_items]
        .sort((a, b) => a.position - b.position)
        .map((i) => ({ productId: i.product_id, name: i.name, qty: i.qty, pricePaise: i.price_paise, status: i.status })),
      refunds: o.order_refunds.map((r) => ({ amountPaise: r.amount_paise, reason: r.reason, createdAt: r.created_at })),
    })),
  };
}

export async function saveProfile(owner: Owner, profile: z.infer<typeof Profile>) {
  const phone = profile.phone ? toE164(profile.phone) : null;
  if (profile.phone && !phone) throw new ApiError(422, "BAD_PHONE", "Please check the phone number");
  const { error } = await owner.db.from("customers").upsert({ user_id: owner.user.id, name: profile.name, phone, pay_with: profile.pay_with }, { onConflict: "user_id" });
  if (error) throw fromPostgres(error);
}

export async function saveAddress(owner: Owner, input: z.infer<typeof Address>, id?: string) {
  await ensureCustomer(owner);
  const { count } = await owner.db.from("customer_addresses").select("id", { count: "exact", head: true }).eq("user_id", owner.user.id);
  if (!id && (count ?? 0) >= 10) throw new ApiError(422, "TOO_MANY", "Up to 10 saved addresses");
  // The first address is the default; a new default replaces the old one.
  const makeDefault = input.is_default ?? (count ?? 0) === 0;
  if (makeDefault) {
    const { error } = await owner.db.from("customer_addresses").update({ is_default: false }).eq("user_id", owner.user.id).eq("is_default", true);
    if (error) throw fromPostgres(error);
  }
  const row = { ...input, is_default: makeDefault, user_id: owner.user.id };
  const { data, error } = id
    ? await owner.db.from("customer_addresses").update(row).eq("id", id).select("id").maybeSingle()
    : await owner.db.from("customer_addresses").insert(row).select("id").single();
  if (error) throw fromPostgres(error);
  if (!data) throw new ApiError(404, "NOT_FOUND", "Address not found");
  return data.id;
}

export async function deleteAddress(owner: Owner, id: string) {
  const { error } = await owner.db.from("customer_addresses").delete().eq("id", id);
  if (error) throw fromPostgres(error);
}

// A product or shop a customer can save: published, in a published shop.
async function publishedProduct(productId: string) {
  const { data } = await adminClient().from("products").select("id, shops!inner(is_published)").eq("id", productId).eq("is_published", true).is("archived_at", null).maybeSingle();
  const shop = data && (Array.isArray(data.shops) ? data.shops[0] : data.shops);
  return Boolean(shop?.is_published);
}

export async function setWishlisted(owner: Owner, productId: string, on: boolean) {
  if (!on) {
    const { error } = await owner.db.from("wishlist_items").delete().eq("user_id", owner.user.id).eq("product_id", productId);
    if (error) throw fromPostgres(error);
    return;
  }
  if (!(await publishedProduct(productId))) throw new ApiError(404, "NOT_FOUND", "Product not found");
  await ensureCustomer(owner);
  const { error } = await owner.db.from("wishlist_items").upsert({ user_id: owner.user.id, product_id: productId }, { onConflict: "user_id,product_id", ignoreDuplicates: true });
  if (error) throw fromPostgres(error);
}

export async function setFavourite(owner: Owner, slug: string, on: boolean) {
  const { data: shop } = await adminClient().from("shops").select("id, is_published").eq("slug", slug).maybeSingle();
  if (!shop?.is_published) throw new ApiError(404, "NOT_FOUND", "Shop not found");
  if (!on) {
    const { error } = await owner.db.from("favourite_shops").delete().eq("user_id", owner.user.id).eq("shop_id", shop.id);
    if (error) throw fromPostgres(error);
    return;
  }
  await ensureCustomer(owner);
  const { error } = await owner.db.from("favourite_shops").upsert({ user_id: owner.user.id, shop_id: shop.id }, { onConflict: "user_id,shop_id", ignoreDuplicates: true });
  if (error) throw fromPostgres(error);
}

// Deletes the customer's details, addresses, wishlist and favourites. Orders
// stay with the shops (they are deleted after 90 days) but lose the link.
// Someone who also owns a shop keeps their sign-in; otherwise it goes too.
export async function deleteCustomer(owner: Owner) {
  const admin = adminClient();
  const { error } = await admin.from("customers").delete().eq("user_id", owner.user.id);
  if (error) throw fromPostgres(error);
  const { error: unlinkError } = await admin.from("orders").update({ customer_id: null }).eq("customer_id", owner.user.id);
  if (unlinkError) throw fromPostgres(unlinkError);
  const { data: shop } = await admin.from("shops").select("id").eq("owner_id", owner.user.id).maybeSingle();
  if (!shop) {
    const { error: userError } = await admin.auth.admin.deleteUser(owner.user.id);
    if (userError) throw new ApiError(500, "DATABASE", "Something went wrong");
    return { signedOut: true };
  }
  return { signedOut: false };
}
