import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";

import { env } from "@/env/server";
import { isLang, type Lang } from "@/i18n/dictionary";
import { productPhoto } from "@/lib/catalog/photo-url";
import { englishName } from "@/server/product-names";
import { asHours, type Hours } from "@/lib/hours";
import type { Database } from "@/types/database";

export interface StorefrontProduct {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  pricePaise: number | null;
  inStock: boolean;
  // The MRP the owner entered, and the product's photo with its credit (V-11).
  mrpPaise: number | null;
  photo: { url: string; credit: string | null } | null;
}

export interface Storefront {
  slug: string;
  name: string;
  category: string | null;
  description: string | null;
  phone: string | null;
  address: string | null;
  timezone: string;
  hours: Hours;
  language: Lang;
  delivers: boolean;
  // How to pay and the delivery rules (V-05).
  upiId: string | null;
  acceptsCash: boolean;
  payOnDelivery: boolean;
  delivery: { minPaise: number | null; feePaise: number | null; freeAbovePaise: number | null; radiusKm: number | null };
  products: StorefrontProduct[];
}

const SLUG = /^[a-z0-9-]{1,100}$/;

// A published shop and its published products, as any customer sees them
// (doc 06 P-1): read with the public key and no session, so the view's anon
// grants apply; never a stock count, only in or out (errata E-05). Cached
// and tagged; every owner edit calls refreshStorefront(slug).
export async function getStorefront(slug: string): Promise<Storefront | null> {
  "use cache";
  cacheTag(`storefront:${slug}`);
  cacheLife("hours");
  if (!SLUG.test(slug)) return null;
  const db = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.from("public_storefront").select("*").eq("slug", slug);
  if (error) throw error;
  if (!data.length) return null; // unknown or unpublished
  const shop = data[0];
  return {
    slug,
    name: shop.shop_name ?? "",
    category: shop.shop_category,
    description: shop.shop_description,
    phone: shop.phone,
    address: shop.address,
    timezone: shop.timezone ?? "Asia/Kolkata",
    hours: asHours(shop.hours),
    language: isLang(shop.language) ? shop.language : "hi",
    delivers: shop.delivers ?? false,
    upiId: shop.upi_id,
    acceptsCash: shop.accepts_cash ?? true,
    payOnDelivery: shop.pay_on_delivery ?? true,
    delivery: {
      minPaise: shop.delivery_min_paise,
      feePaise: shop.delivery_fee_paise,
      freeAbovePaise: shop.free_delivery_above_paise,
      radiusKm: shop.delivery_radius_km === null ? null : Number(shop.delivery_radius_km),
    },
    products: data
      .filter((row) => row.product_id && row.product_name)
      .map((row) => ({
        id: row.product_id!,
        name: row.product_name!,
        category: row.product_category,
        unit: row.unit,
        pricePaise: row.price_paise,
        inStock: row.in_stock ?? false,
        mrpPaise: row.mrp_paise,
        photo: productPhoto({ imagePath: row.image_path, imageCredit: row.image_credit, name: englishName(row.product_name!), unit: row.unit }, env.NEXT_PUBLIC_SUPABASE_URL),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// After any owner edit that customers can see. `expire: 0` means the next
// visitor never gets the old page: an unpublished shop or an out-of-stock
// item must show at once (doc 03 TH-10), not after a background refresh.
export function refreshStorefront(slug: string) {
  revalidateTag(`storefront:${slug}`, { expire: 0 });
}

