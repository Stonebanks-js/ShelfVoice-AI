// Product photos (V-11) against the local database and Storage. Open Food
// Facts and its image host are stubs: tests never reach the internet.
// Needs `supabase start`.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { admin, testOwner } from "./helpers";

vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), after: () => undefined }));
vi.mock("@/server/storefront", () => ({ refreshStorefront: vi.fn() }));

const OFF = "https://off.test";
process.env.OPEN_FOOD_FACTS_URL = OFF;
const IMAGES = "https://images.openfoodfacts.org";
const photo = (code: string) => `${IMAGES}/images/products/${code.slice(0, 3)}/${code.slice(3)}/front_en.4.400.jpg`;
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 0xff, 0xd9]);

const realFetch = globalThis.fetch;
let offDown = false;
const products: Record<string, { product_name: string; quantity: string }> = {
  "8904043901015": { product_name: "Tata Salt", quantity: "1 kg" },
  "8904043901016": { product_name: "Tata Salt", quantity: "500 g" },
  "8904043926612": { product_name: "Tata Salt Himalayan Rock", quantity: "1 kg" },
  "8904043905457": { product_name: "Tata Salt", quantity: "" },
};
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

beforeAll(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith(IMAGES)) {
      if (offDown) throw new TypeError("fetch failed");
      return new Response(JPEG, { headers: { "content-type": "image/jpeg" } });
    }
    if (!url.startsWith(OFF)) return realFetch(input, init);
    if (offDown) throw new TypeError("fetch failed");
    const byCode = /product\/(\d+)/.exec(url)?.[1];
    if (byCode) {
      const p = products[byCode];
      return p ? json({ status: 1, product: { code: byCode, ...p, image_front_url: photo(byCode) } }) : new Response("", { status: 404 });
    }
    return json({ products: Object.entries(products).map(([code, p]) => ({ code, ...p, brands: "Tata", image_front_url: photo(code) })) });
  });
});
afterAll(() => vi.restoreAllMocks());
beforeEach(() => {
  offDown = false;
});

const { photoCandidates, choosePhoto, removePhoto } = await import("@/server/product-photos");
const { addProducts } = await import("@/server/catalog");

async function ownerWithSalt() {
  const owner = await testOwner();
  const { data } = await owner.db.from("products").insert({ shop_id: owner.shop.id, name: "Tata Salt", unit: "1 kg", price_paise: 2500 }).select("id").single();
  return { owner, id: data!.id };
}

describe("finding a product's photo", () => {
  it("offers the same name and pack first, and never another size or variant", async () => {
    const { owner, id } = await ownerWithSalt();
    const { available, candidates } = await photoCandidates(owner, id);
    expect(available).toBe(true);
    expect(candidates.map((c) => [c.code, c.status])).toEqual([
      ["8904043901015", "exact"],
      ["8904043905457", "uncertain"],
    ]);
  });

  it("puts the barcode's own product first", async () => {
    const { owner, id } = await ownerWithSalt();
    await owner.db.from("products").update({ barcode: "8904043905457" }).eq("id", id);
    const { candidates } = await photoCandidates(owner, id);
    expect(candidates[0]).toMatchObject({ code: "8904043905457", status: "exact" });
  });

  it("says photo search is unavailable when Open Food Facts is down", async () => {
    const { owner, id } = await ownerWithSalt();
    offDown = true;
    expect(await photoCandidates(owner, id)).toEqual({ available: false, candidates: [] });
  });
});

describe("choosing and removing a photo", () => {
  it("copies the chosen photo into the shop's own folder and credits it", async () => {
    const { owner, id } = await ownerWithSalt();
    const { imagePath } = await choosePhoto(owner, id, "8904043901015");
    expect(imagePath.startsWith(`${owner.shop.id}/${id}-`)).toBe(true);
    const { data: row } = await admin.from("products").select("image_path, image_source, image_source_id, image_verified, image_credit").eq("id", id).single();
    expect(row).toEqual({ image_path: imagePath, image_source: "OPEN_FOOD_FACTS", image_source_id: "8904043901015", image_verified: true, image_credit: "Open Food Facts contributors, CC BY-SA" });
    const { data: file } = await admin.storage.from("catalog-images").download(imagePath);
    expect(file?.size).toBe(JPEG.length);

    // A second choice replaces the first, and its file goes.
    const second = await choosePhoto(owner, id, "8904043905457");
    expect((await admin.storage.from("catalog-images").download(imagePath)).data).toBeNull();
    await removePhoto(owner, id);
    const { data: cleared } = await admin.from("products").select("image_path, image_verified").eq("id", id).single();
    expect(cleared).toEqual({ image_path: null, image_verified: false });
    expect((await admin.storage.from("catalog-images").download(second.imagePath)).data).toBeNull();
  });

  it("never touches another shop's product", async () => {
    const { id } = await ownerWithSalt();
    const other = await testOwner();
    await expect(photoCandidates(other, id)).rejects.toMatchObject({ status: 404 });
    await expect(choosePhoto(other, id, "8904043901015")).rejects.toMatchObject({ status: 404 });
    await expect(removePhoto(other, id)).rejects.toMatchObject({ status: 404 });
  });

  it("keeps the product as it was when the photo can't be fetched", async () => {
    const { owner, id } = await ownerWithSalt();
    offDown = true;
    await expect(choosePhoto(owner, id, "8904043901015")).rejects.toMatchObject({ status: 503 });
    const { data } = await admin.from("products").select("image_path, price_paise").eq("id", id).single();
    expect(data).toEqual({ image_path: null, price_paise: 2500 });
  });

  it("adds products as before while photo search is down", async () => {
    const owner = await testOwner();
    offDown = true;
    const { added } = await addProducts({ ...owner, requestId: "t" }, [{ name: "Parle-G", unit: "100 g", price_paise: 1000 }]);
    expect(added).toHaveLength(1);
  });
});
