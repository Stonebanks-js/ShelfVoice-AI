import "server-only";

import { after } from "next/server";
import { z } from "zod";

import { env } from "@/env/server";
import { haveKey, matchStarter } from "@/lib/catalog/starter";
import { refreshForecasts } from "@/server/forecast/refresh";
import { fromPostgres } from "@/server/http";
import { log } from "@/server/log";
import type { Owner, Shop } from "@/server/owner";
import { refreshStorefront } from "@/server/storefront";
import { adminClient } from "@/server/supabase";

type Ctx = Owner & { shop: Shop; requestId: string };

export const Barcode = z.string().regex(/^[0-9]{8,14}$/);

// One product as an owner adds it by tap, from a list, a sheet or a scan.
export const ProductInput = z
  .object({
    name: z.string().trim().min(1).max(80),
    unit: z.string().trim().max(40).nullable().optional(),
    category: z.string().trim().max(80).nullable().optional(),
    price_paise: z.number().int().positive().max(10_000_000).nullable().optional(),
    aliases: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
    stock_qty: z.number().int().min(0).max(10_000).nullable().optional(),
    low_stock_level: z.number().int().min(0).max(10_000).optional(),
    pack_size: z.number().int().min(1).max(10_000).optional(),
    barcode: Barcode.nullable().optional(),
  })
  .strict();
export type ProductInput = z.infer<typeof ProductInput>;

// A whole ready-made list or spreadsheet at once (V-01).
export const MAX_BULK = 500;

const inStock = (qty: number | null | undefined) => qty === undefined || qty === null || qty > 0;

// New products get forecast rows right away, so a low count warns today.
function afterAdding(ctx: Ctx, ids: string[]) {
  refreshStorefront(ctx.shop.slug);
  if (ids.length === 0) return;
  after(async () => {
    try {
      await refreshForecasts(ctx.shop.id, ids);
    } catch (failure) {
      log("error", "forecast.refresh_failed", { requestId: ctx.requestId, shopId: ctx.shop.id, error: failure });
    }
  });
}

export async function addProduct(ctx: Ctx, input: ProductInput) {
  const { data, error } = await ctx.db
    .from("products")
    .insert({ ...input, shop_id: ctx.shop.id, is_in_stock: inStock(input.stock_qty) })
    .select("*")
    .single();
  if (error) throw fromPostgres(error);
  afterAdding(ctx, [data.id]);
  return data;
}

// Adds every product the shop doesn't already have (same name and pack
// size, or same barcode), so ticking a list twice or re-uploading a sheet
// never makes duplicates. Returns what was added and how many were skipped.
export async function addProducts(ctx: Ctx, inputs: ProductInput[]) {
  const { data: current, error: readError } = await ctx.db
    .from("products")
    .select("name, unit, barcode")
    .eq("shop_id", ctx.shop.id)
    .is("archived_at", null);
  if (readError) throw fromPostgres(readError);
  const names = new Set(current.map((p) => haveKey(p.name, p.unit)));
  const barcodes = new Set(current.map((p) => p.barcode).filter(Boolean));

  const fresh: ProductInput[] = [];
  for (const input of inputs) {
    const key = haveKey(input.name, input.unit);
    if (names.has(key) || (input.barcode && barcodes.has(input.barcode))) continue;
    names.add(key);
    if (input.barcode) barcodes.add(input.barcode);
    fresh.push(input);
  }
  if (fresh.length === 0) return { added: [], skipped: inputs.length };

  const { data, error } = await ctx.db
    .from("products")
    .insert(
      // Every row lists every column: a multi-row insert fills a missing
      // column with null, not its default.
      fresh.map((p) => ({
        shop_id: ctx.shop.id,
        name: p.name,
        unit: p.unit ?? null,
        category: p.category ?? null,
        price_paise: p.price_paise ?? null,
        aliases: p.aliases ?? [],
        stock_qty: p.stock_qty ?? null,
        low_stock_level: p.low_stock_level ?? 5,
        pack_size: p.pack_size ?? 1,
        barcode: p.barcode ?? null,
        is_in_stock: inStock(p.stock_qty),
      })),
    )
    .select("*");
  if (error) throw fromPostgres(error);
  afterAdding(
    ctx,
    data.map((p) => p.id),
  );
  return { added: data, skipped: inputs.length - data.length };
}

// ------------------------------------------------------------------ barcodes
export interface BarcodeSuggestion {
  name: string;
  unit: string | null;
  category: string | null;
  pricePaise: number | null;
  aliases: string[];
}

interface Lookup {
  found: boolean;
  name: string | null;
  brand: string | null;
  quantity: string | null;
}

const clip = (text: unknown, max: number) => (typeof text === "string" && text.trim() ? text.trim().slice(0, max) : null);

// Open Food Facts' answer for one code, or null when it couldn't be asked
// (switched off, slow, down). Only "not found" is cached as not found.
async function askOpenFoodFacts(code: string): Promise<Lookup | null> {
  if (env.OPEN_FOOD_FACTS_URL === "off") return null;
  try {
    const url = `${env.OPEN_FOOD_FACTS_URL.replace(/\/$/, "")}/api/v2/product/${code}?fields=product_name,product_name_en,brands,quantity`;
    const response = await fetch(url, {
      // Open Food Facts asks every app to name itself.
      headers: { "User-Agent": "ShelfVoice/1.0 (https://shelfvoice.vercel.app)" },
      signal: AbortSignal.timeout(4000),
    });
    if (response.status === 404) return { found: false, name: null, brand: null, quantity: null };
    if (!response.ok) return null;
    const body = (await response.json()) as { status?: number; product?: Record<string, unknown> };
    const product = body.product ?? {};
    const name = clip(product.product_name_en, 120) ?? clip(product.product_name, 120);
    if (body.status !== 1 || !name) return { found: false, name: null, brand: null, quantity: null };
    const brand = clip(typeof product.brands === "string" ? product.brands.split(",")[0] : null, 80);
    return { found: true, name, brand, quantity: clip(product.quantity, 40) };
  } catch {
    return null;
  }
}

async function lookup(code: string): Promise<Lookup | null> {
  const admin = adminClient();
  const { data: cached } = await admin.from("barcode_lookups").select("found, name, brand, quantity").eq("code", code).maybeSingle();
  if (cached) return cached;
  const fresh = await askOpenFoodFacts(code);
  if (fresh) {
    const { error } = await admin.from("barcode_lookups").upsert({ code, ...fresh });
    if (error) log("warn", "barcode.cache_failed", { code, error: error.message });
  }
  return fresh;
}

export function suggestionFrom(found: Lookup): BarcodeSuggestion | null {
  if (!found.found || !found.name) return null;
  // Open Food Facts often leaves the brand out of the name.
  const name = found.brand && !found.name.toLowerCase().includes(found.brand.toLowerCase()) ? `${found.brand} ${found.name}` : found.name;
  const starter = matchStarter(name, found.quantity);
  return {
    name: name.slice(0, 80),
    unit: found.quantity?.slice(0, 40) ?? starter?.unit ?? null,
    category: starter?.category ?? null,
    pricePaise: starter?.pricePaise ?? null,
    aliases: starter?.aliases ?? [],
  };
}

// What a scanned code is: one of the shop's products, a name to suggest for
// a new one, or nothing known (the owner names it, and the shop learns it).
export async function scanBarcode(ctx: Ctx, code: string) {
  const { data: product, error } = await ctx.db
    .from("products")
    .select("*")
    .eq("shop_id", ctx.shop.id)
    .eq("barcode", code)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw fromPostgres(error);
  if (product) return { product, suggestion: null };
  const found = await lookup(code);
  return { product: null, suggestion: found ? suggestionFrom(found) : null };
}
