import { judge, words } from "./match";
import { OFF_CREDIT } from "./off";
import { CATALOG_PHOTOS } from "./photos";

// Where a product's photo comes from (V-11, V-12), first match wins:
// 1. the photo the owner chose, copied into the shop's own Storage folder;
// 2. the ready-made list's checked image for this product: the same name
//    and pack, or (V-12) the same product written a little differently by
//    an owner or their voice ("Britannia Bread", "Surf Excel" with no size),
//    as long as no word marks another variant and the sizes agree;
// 3. none: the drawn tile.
// The stored path is only trusted in its own shop's folder shape; anything
// else is ignored, so a bad value never becomes an address in the page.
const OWN_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}-[0-9]{1,13}\.(jpg|webp)$/;

export const GENERATED_CREDIT = "Illustration made with Meta Muse Image";

export interface Photo {
  url: string;
  credit: string | null;
}

export const catalogKey = (name: string, unit: string | null | undefined) => `${name.trim()}|${(unit ?? "").trim()}`.toLowerCase();

const ENTRIES = Object.entries(CATALOG_PHOTOS).map(([key, value]) => {
  const [name, unit] = key.split("|");
  return { key, name, unit, words: new Set(words(name)), ...value };
});

const brandOf = (name: string) => name.trim().toLowerCase().split(/[\s-]+/)[0];

// The ready-made entry this product is, or null. Either name may hold the
// other ("Parle-G" and "Parle-G Biscuit"); a clear best is required, unless
// the close ones are packs of the same brand.
export function catalogMatch(name: string, unit: string | null | undefined): (typeof ENTRIES)[number] | null {
  const exact = CATALOG_PHOTOS[catalogKey(name, unit)];
  if (exact) return ENTRIES.find((e) => e.file === exact.file)!;
  const mine = words(name);
  if (!mine.length) return null;
  // Only entries sharing a word can match; the rest are skipped unjudged.
  const scored = ENTRIES.filter((entry) => mine.some((w) => entry.words.has(w))).map((entry) => {
    const there = judge({ name, unit }, { code: entry.key, name: entry.name, quantity: entry.unit });
    const back = judge({ name: entry.name, unit: entry.unit }, { code: entry.key, name, quantity: unit ?? null });
    return { entry, score: Math.max(there.status === "no" ? 0 : there.score, back.status === "no" ? 0 : back.score) };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  const [best] = scored;
  if (!best) return null;
  // Equally good packs of another brand: the name doesn't say which.
  if (scored.some((s) => s.score === best.score && brandOf(s.entry.name) !== brandOf(best.entry.name))) return null;
  return best.entry;
}

export function productPhoto(
  product: { imagePath?: string | null; imageCredit?: string | null; name: string; unit?: string | null },
  supabaseUrl: string,
): Photo | null {
  if (product.imagePath && OWN_PATH.test(product.imagePath)) {
    return { url: `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/catalog-images/${product.imagePath}`, credit: product.imageCredit ?? null };
  }
  const listed = catalogMatch(product.name, product.unit);
  if (!listed) return null;
  return { url: `/catalog/${listed.file}`, credit: listed.source === "generated" ? GENERATED_CREDIT : OFF_CREDIT };
}
