import "server-only";

import { env } from "@/env/server";
import { productPhoto } from "@/lib/catalog/photo-url";
import { englishName } from "@/server/product-names";

// Each product with the photo customers see (V-12), for the owner's lists.
export function withPhotos<P extends { name: string; unit: string | null; image_path?: string | null; image_credit?: string | null }>(products: P[]): Array<P & { photo_url: string | null }> {
  return products.map((p) => ({
    ...p,
    photo_url: productPhoto({ imagePath: p.image_path, imageCredit: p.image_credit, name: englishName(p.name), unit: p.unit }, env.NEXT_PUBLIC_SUPABASE_URL)?.url ?? null,
  }));
}
