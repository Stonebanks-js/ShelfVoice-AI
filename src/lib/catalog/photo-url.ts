import { OFF_CREDIT } from "./off";
import { CATALOG_PHOTOS } from "./photos";

// Where a product's photo comes from (V-11), first match wins:
// 1. the photo the owner chose, copied into the shop's own Storage folder;
// 2. the ready-made list's photo for exactly this name and pack, checked by
//    a person and shipped with the app (public/catalog);
// 3. none: the drawn tile.
// The stored path is only trusted in its own shop's folder shape; anything
// else is ignored, so a bad value never becomes an address in the page.
const OWN_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}-[0-9]{1,13}\.(jpg|webp)$/;

export interface Photo {
  url: string;
  credit: string | null;
}

export const catalogKey = (name: string, unit: string | null | undefined) => `${name.trim()}|${(unit ?? "").trim()}`.toLowerCase();

export function productPhoto(
  product: { imagePath?: string | null; imageCredit?: string | null; name: string; unit?: string | null },
  supabaseUrl: string,
): Photo | null {
  if (product.imagePath && OWN_PATH.test(product.imagePath)) {
    return { url: `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/catalog-images/${product.imagePath}`, credit: product.imageCredit ?? null };
  }
  const listed = CATALOG_PHOTOS[catalogKey(product.name, product.unit)];
  return listed ? { url: `/catalog/${listed.file}`, credit: OFF_CREDIT } : null;
}
