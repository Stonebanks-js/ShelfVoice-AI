import "server-only";

import { env } from "@/env/server";
import { rank } from "@/lib/catalog/match";
import { candidateFromProduct, candidatesFromSearch, getJson, isOffImageUrl, OFF_CREDIT, OFF_USER_AGENT, productUrl, searchUrl, type OffCandidate } from "@/lib/catalog/off";
import { ApiError, fromPostgres } from "@/server/http";
import { log } from "@/server/log";
import type { Owner, Shop } from "@/server/owner";
import { refreshStorefront } from "@/server/storefront";
import { adminClient } from "@/server/supabase";

type Ctx = Owner & { shop: Shop };

export interface PhotoCandidate {
  code: string;
  name: string;
  quantity: string | null;
  imageUrl: string;
  // "exact" and "likely" are the same name and pack; "uncertain" needs a look.
  status: "exact" | "likely" | "uncertain";
}

// Open Food Facts down or slow: after three failures in a row, stop asking
// for a minute, so owners get an answer at once instead of waiting on it.
const breaker = { failures: 0, openUntil: 0 };
async function askOff(url: string): Promise<unknown> {
  if (Date.now() < breaker.openUntil) throw new Error("photo search paused");
  try {
    const json = await getJson(url, { timeoutMs: 6000, tries: 2 });
    breaker.failures = 0;
    return json;
  } catch (failure) {
    if (++breaker.failures >= 3) breaker.openUntil = Date.now() + 60_000;
    throw failure;
  }
}

async function ownProduct(ctx: Ctx, id: string) {
  const { data, error } = await ctx.db
    .from("products")
    .select("id, name, unit, barcode, image_path")
    .eq("id", id)
    .eq("shop_id", ctx.shop.id)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw fromPostgres(error);
  if (!data) throw new ApiError(404, "NOT_FOUND", "Product not found");
  return data;
}

// Photos that may be this product: by its barcode first, then by its
// name, judged against its name and pack, best first. Never saved here: the
// owner chooses. An empty list when the service is off or unreachable, so
// the sheet simply says no photos were found.
export async function photoCandidates(ctx: Ctx, id: string): Promise<{ available: boolean; candidates: PhotoCandidate[] }> {
  const product = await ownProduct(ctx, id);
  if (env.OPEN_FOOD_FACTS_URL === "off") return { available: false, candidates: [] };
  const found: OffCandidate[] = [];
  try {
    if (product.barcode) {
      const byCode = candidateFromProduct(await askOff(productUrl(env.OPEN_FOOD_FACTS_URL, product.barcode)));
      if (byCode) found.push(byCode);
    }
    found.push(...candidatesFromSearch(await askOff(searchUrl(env.OPEN_FOOD_FACTS_URL, product.name))));
  } catch (failure) {
    log("warn", "photos.search_failed", { shopId: ctx.shop.id, error: failure });
    if (!found.length) return { available: false, candidates: [] };
  }
  const ranked = rank({ name: product.name, unit: product.unit, barcode: product.barcode }, found).slice(0, 8);
  return {
    available: true,
    candidates: ranked.map((m) => ({
      code: m.candidate.code,
      name: m.candidate.name,
      quantity: m.candidate.quantity ?? null,
      imageUrl: m.candidate.imageUrl,
      status: m.status as PhotoCandidate["status"],
    })),
  };
}

// The owner's choice, by its Open Food Facts barcode: the photo address is
// looked up again here, never taken from the browser, then copied into the
// shop's own folder. The old photo is removed once the new one is saved.
export async function choosePhoto(ctx: Ctx, id: string, code: string) {
  const product = await ownProduct(ctx, id);
  if (env.OPEN_FOOD_FACTS_URL === "off") throw new ApiError(503, "PHOTOS_UNAVAILABLE", "Photo search isn't available right now");
  let chosen: OffCandidate | null;
  try {
    chosen = candidateFromProduct(await askOff(productUrl(env.OPEN_FOOD_FACTS_URL, code)));
  } catch {
    throw new ApiError(503, "PHOTOS_UNAVAILABLE", "Photo search isn't available right now");
  }
  if (!chosen || !isOffImageUrl(chosen.imageUrl)) throw new ApiError(404, "NOT_FOUND", "That photo is no longer there");

  let bytes: ArrayBuffer;
  try {
    const res = await fetch(chosen.imageUrl, { headers: { "User-Agent": OFF_USER_AGENT }, signal: AbortSignal.timeout(8000), redirect: "error" });
    if (!res.ok || res.headers.get("content-type") !== "image/jpeg") throw new Error(`photo HTTP ${res.status}`);
    bytes = await res.arrayBuffer();
  } catch (failure) {
    log("warn", "photos.download_failed", { shopId: ctx.shop.id, error: failure });
    throw new ApiError(503, "PHOTOS_UNAVAILABLE", "Photo search isn't available right now");
  }
  if (bytes.byteLength === 0 || bytes.byteLength > 1_000_000) throw new ApiError(415, "BAD_PHOTO", "That photo can't be used");

  const path = `${ctx.shop.id}/${product.id}-${Date.now()}.jpg`;
  const storage = adminClient().storage.from("catalog-images");
  const { error: uploadError } = await storage.upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (uploadError) {
    log("error", "photos.upload_failed", { shopId: ctx.shop.id, error: uploadError.message });
    throw new ApiError(500, "STORAGE", "Couldn't save the photo");
  }
  const { error } = await ctx.db
    .from("products")
    .update({ image_path: path, image_source: "OPEN_FOOD_FACTS", image_source_id: chosen.code, image_verified: true, image_credit: OFF_CREDIT, image_checked_at: new Date().toISOString() })
    .eq("id", product.id);
  if (error) {
    await storage.remove([path]);
    throw fromPostgres(error);
  }
  if (product.image_path) await storage.remove([product.image_path]);
  refreshStorefront(ctx.shop.slug);
  return { imagePath: path };
}

// Back to the ready-made photo or the drawn tile.
export async function removePhoto(ctx: Ctx, id: string) {
  const product = await ownProduct(ctx, id);
  const { error } = await ctx.db
    .from("products")
    .update({ image_path: null, image_source: null, image_source_id: null, image_verified: false, image_credit: null, image_checked_at: null })
    .eq("id", product.id);
  if (error) throw fromPostgres(error);
  if (product.image_path) await adminClient().storage.from("catalog-images").remove([product.image_path]);
  refreshStorefront(ctx.shop.slug);
}
