// Bulk adding and barcodes (V-01) against the local database. Open Food
// Facts is replaced by a stub at a test address: tests never reach the
// internet. Needs `supabase start`.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { admin, testOwner } from "./helpers";

// Outside a Next request there is no `after()` or cache to revalidate;
// work queued for after the response is collected so tests can wait for it.
const afterTasks: Array<Promise<void>> = [];
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => Promise<void>) => void afterTasks.push(task()),
}));
vi.mock("@/server/storefront", () => ({ refreshStorefront: vi.fn() }));

const OFF = "https://off.test";
process.env.OPEN_FOOD_FACTS_URL = OFF;
const realFetch = globalThis.fetch;
const offAnswers = new Map<string, () => Response>();
const offCalls: string[] = [];
beforeAll(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(OFF)) return realFetch(input, init);
    offCalls.push(url);
    const code = /product\/(\d+)/.exec(url)![1];
    return offAnswers.get(code)?.() ?? new Response(JSON.stringify({ status: 0 }), { status: 404 });
  });
});
afterAll(() => vi.restoreAllMocks());

const { addProducts, scanBarcode, suggestionFrom } = await import("@/server/catalog");

const code = () => String(Date.now()).padStart(13, "8").slice(-13);

describe("adding many products at once", () => {
  it("adds new products, skipping ones the shop has and repeats in the batch", async () => {
    const owner = await testOwner();
    await owner.db.from("products").insert({ shop_id: owner.shop.id, name: "Tata Salt", unit: "1 kg" });
    const { added, skipped } = await addProducts(owner, [
      { name: "tata salt ", unit: "1 KG", price_paise: 2800 },
      { name: "Parle-G", unit: "80 g", price_paise: 1000, category: "Biscuits", aliases: ["parle"] },
      { name: "Parle-G", unit: "80 g" },
      { name: "Loose Atta", unit: "1 kg", stock_qty: 0 },
      { name: "Maggi", unit: "70 g", stock_qty: 12, barcode: "8901058000290" },
    ]);
    expect(skipped).toBe(2);
    expect(added.map((p) => p.name).sort()).toEqual(["Loose Atta", "Maggi", "Parle-G"]);
    const atta = added.find((p) => p.name === "Loose Atta")!;
    // Columns not given keep their defaults; a count of 0 is out of stock.
    expect(atta).toMatchObject({ low_stock_level: 5, pack_size: 1, aliases: [], is_in_stock: false, stock_qty: 0 });
    expect(added.find((p) => p.name === "Maggi")).toMatchObject({ is_in_stock: true, barcode: "8901058000290" });
    await Promise.all(afterTasks);
    const { count } = await admin.from("product_forecasts").select("product_id", { count: "exact", head: true }).eq("shop_id", owner.shop.id);
    expect(count).toBe(3);

    // The same barcode under another name is the same product.
    expect((await addProducts(owner, [{ name: "Maggi Masala", barcode: "8901058000290" }])).skipped).toBe(1);
  });

  it("lets two shops carry the same barcode", async () => {
    const [a, b] = [await testOwner(), await testOwner()];
    expect((await addProducts(a, [{ name: "Maggi", barcode: "8901058000306" }])).added).toHaveLength(1);
    expect((await addProducts(b, [{ name: "Maggi", barcode: "8901058000306" }])).added).toHaveLength(1);
  });
});

describe("scanning a barcode", () => {
  it("finds the shop's own product first, without asking Open Food Facts", async () => {
    const owner = await testOwner();
    const barcode = code();
    const { added } = await addProducts(owner, [{ name: "Amul Butter", unit: "100 g", barcode }]);
    const calls = offCalls.length;
    expect(await scanBarcode(owner, barcode)).toMatchObject({ product: { id: added[0].id }, suggestion: null });
    expect(offCalls.length).toBe(calls);
  });

  it("names a new pack from Open Food Facts, with a typical price, and asks only once", async () => {
    const owner = await testOwner();
    const barcode = code();
    offAnswers.set(barcode, () =>
      Response.json({ status: 1, product: { product_name: "Salt", brands: "Tata,Tata Consumer", quantity: "1 kg" } }),
    );
    const first = await scanBarcode(owner, barcode);
    expect(first).toEqual({
      product: null,
      suggestion: { name: "Tata Salt", unit: "1 kg", category: "Staples", pricePaise: 2800, aliases: ["namak", "नमक", "salt"] },
    });
    expect(offCalls.at(-1)).toContain(`/api/v2/product/${barcode}?fields=`);
    const calls = offCalls.length;
    expect(await scanBarcode(await testOwner(), barcode)).toEqual(first);
    expect(offCalls.length).toBe(calls); // cached for every shop
  });

  it("remembers unknown codes, and asks again after an outage", async () => {
    const owner = await testOwner();
    const unknown = code();
    expect(await scanBarcode(owner, unknown)).toEqual({ product: null, suggestion: null });
    const { data } = await admin.from("barcode_lookups").select("found").eq("code", unknown).single();
    expect(data!.found).toBe(false);

    const flaky = `${code().slice(0, 12)}7`;
    offAnswers.set(flaky, () => new Response("busy", { status: 503 }));
    expect((await scanBarcode(owner, flaky)).suggestion).toBeNull();
    const { data: none } = await admin.from("barcode_lookups").select("code").eq("code", flaky).maybeSingle();
    expect(none).toBeNull();
  });

  it("keeps the lookup cache away from owners", async () => {
    const owner = await testOwner();
    const { data, error } = await owner.db.from("barcode_lookups").select("code").limit(1);
    expect(data ?? []).toEqual([]);
    expect(error?.code ?? "42501").toBe("42501");
  });
});

describe("turning a lookup into a suggestion", () => {
  it("adds the brand when the name leaves it out, and keeps names that have it", () => {
    expect(suggestionFrom({ found: true, name: "Parle-G Gold", brand: "Parle", quantity: null })?.name).toBe("Parle-G Gold");
    expect(suggestionFrom({ found: true, name: "Gold Biscuits", brand: "Parle", quantity: "100 g" })).toMatchObject({ name: "Parle Gold Biscuits", unit: "100 g" });
    expect(suggestionFrom({ found: false, name: null, brand: null, quantity: null })).toBeNull();
  });
});
