import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";

import { env } from "@/env/server";
import type { Lang } from "@/i18n/dictionary";
import { asHours, type Hours } from "@/lib/hours";
import type { Database } from "@/types/database";

export interface StorefrontProduct {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  pricePaise: number | null;
  inStock: boolean;
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
    name: shop.shop_name,
    category: shop.shop_category,
    description: shop.shop_description,
    phone: shop.phone,
    address: shop.address,
    timezone: shop.timezone,
    hours: asHours(shop.hours),
    language: shop.language === "en" ? "en" : "hi",
    products: data
      .filter((row) => row.product_id && row.product_name)
      .map((row) => ({
        id: row.product_id!,
        name: row.product_name!,
        category: row.product_category,
        unit: row.unit,
        pricePaise: row.price_paise,
        inStock: row.in_stock ?? false,
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

