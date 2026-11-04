import { z } from "zod";

import type { Candidate } from "./match";

// Open Food Facts, read for product photos (V-11): the documented search
// (cgi/search.pl) and product (api/v2/product) endpoints, free with no key.
// Photos are CC BY-SA: whoever shows one credits "Open Food Facts
// contributors". Responses are checked before use, and a photo address is
// only accepted from OFF's own image host, so nothing else can be fetched.

export const OFF_CREDIT = "Open Food Facts contributors, CC BY-SA";
export const OFF_USER_AGENT = "ShelfVoice/1.0 (https://shelfvoice.vercel.app)";
const IMAGE_HOST = "images.openfoodfacts.org";
const FIELDS = "code,product_name,product_name_en,brands,quantity,image_front_url";

export interface OffCandidate extends Candidate {
  imageUrl: string;
}

const Product = z
  .object({
    code: z.string().regex(/^[0-9]{6,14}$/),
    product_name: z.string().max(300).optional().nullable(),
    product_name_en: z.string().max(300).optional().nullable(),
    brands: z.string().max(300).optional().nullable(),
    quantity: z.string().max(80).optional().nullable(),
    image_front_url: z.string().max(500).optional().nullable(),
  })
  .loose();

const SearchBody = z.object({ products: z.array(z.unknown()).max(200) }).loose();
const ProductBody = z.object({ status: z.number().optional(), product: z.unknown().optional() }).loose();

// A front photo on OFF's image host and nowhere else: https, no port, no
// credentials, a product image path, a JPEG.
export function isOffImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === IMAGE_HOST &&
      !url.port &&
      !url.username &&
      !url.password &&
      /^\/images\/products\/[0-9/]+\/[a-z0-9_.-]+\.jpg$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function candidate(raw: unknown): OffCandidate | null {
  const parsed = Product.safeParse(raw);
  if (!parsed.success) return null;
  const p = parsed.data;
  const name = (p.product_name_en || p.product_name || "").trim();
  const imageUrl = p.image_front_url ?? "";
  if (!name || !isOffImageUrl(imageUrl)) return null;
  return { code: p.code, name, brands: p.brands ?? null, quantity: p.quantity ?? null, imageUrl };
}

export function searchUrl(base: string, query: string): string {
  const url = new URL("/cgi/search.pl", base);
  url.search = new URLSearchParams({
    search_terms: query.slice(0, 120),
    search_simple: "1",
    json: "1",
    page_size: "24",
    tagtype_0: "countries",
    tag_contains_0: "contains",
    tag_0: "india",
    fields: FIELDS,
  }).toString();
  return url.toString();
}

export function productUrl(base: string, code: string): string {
  return new URL(`/api/v2/product/${encodeURIComponent(code)}?fields=${FIELDS}`, base).toString();
}

// Search results with a usable photo; anything malformed is skipped.
export function candidatesFromSearch(json: unknown): OffCandidate[] {
  const body = SearchBody.safeParse(json);
  if (!body.success) return [];
  return body.data.products.map(candidate).filter((c): c is OffCandidate => c !== null);
}

export function candidateFromProduct(json: unknown): OffCandidate | null {
  const body = ProductBody.safeParse(json);
  if (!body.success || body.data.status !== 1) return null;
  return candidate(body.data.product);
}

// GET with a hard timeout, and at most `tries` attempts on a rate limit,
// server error or network failure, backing off with jitter. JSON only: OFF
// answers an overload with an HTML page, which counts as a failure.
export async function getJson(url: string, { timeoutMs = 6000, tries = 2, fetcher = fetch }: { timeoutMs?: number; tries?: number; fetcher?: typeof fetch } = {}): Promise<unknown> {
  let last: unknown = null;
  for (let attempt = 0; attempt < tries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 400 * 2 ** attempt + Math.random() * 300));
    try {
      const res = await fetcher(url, { headers: { "User-Agent": OFF_USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs), redirect: "error" });
      if (res.status === 404) return null;
      if (res.status === 429 || res.status >= 500) {
        last = new Error(`HTTP ${res.status}`);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!(res.headers.get("content-type") ?? "").includes("json")) {
        last = new Error("not JSON");
        continue;
      }
      return await res.json();
    } catch (failure) {
      last = failure;
    }
  }
  throw last instanceof Error ? last : new Error("request failed");
}
