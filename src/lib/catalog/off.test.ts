import { describe, expect, it, vi } from "vitest";

import { candidateFromProduct, candidatesFromSearch, getJson, isOffImageUrl, searchUrl } from "./off";

const photo = "https://images.openfoodfacts.org/images/products/890/172/501/6838/front_en.12.400.jpg";

describe("Open Food Facts responses", () => {
  it("accepts photos only from OFF's image host", () => {
    expect(isOffImageUrl(photo)).toBe(true);
    expect(isOffImageUrl("http://images.openfoodfacts.org/images/products/1/front.jpg")).toBe(false);
    expect(isOffImageUrl("https://evil.example/images/products/1/front.jpg")).toBe(false);
    expect(isOffImageUrl("https://images.openfoodfacts.org.evil.example/images/products/1/front.jpg")).toBe(false);
    expect(isOffImageUrl("https://user@images.openfoodfacts.org/images/products/1/front.jpg")).toBe(false);
    expect(isOffImageUrl("https://images.openfoodfacts.org:8443/images/products/1/front.jpg")).toBe(false);
    expect(isOffImageUrl("https://images.openfoodfacts.org/../../etc/passwd")).toBe(false);
    expect(isOffImageUrl("not a url")).toBe(false);
  });

  it("keeps well-formed results with a photo and skips the rest", () => {
    const found = candidatesFromSearch({
      products: [
        { code: "8901725016838", product_name: "Aashirvaad Atta", brands: "Aashirvaad", quantity: "5 kg", image_front_url: photo },
        { code: "8901725016839", product_name: "No photo" },
        { code: "x", product_name: "Bad code", image_front_url: photo },
        { code: "8901725016840", product_name: "Elsewhere", image_front_url: "https://evil.example/a.jpg" },
        "junk",
      ],
    });
    expect(found).toEqual([{ code: "8901725016838", name: "Aashirvaad Atta", brands: "Aashirvaad", quantity: "5 kg", imageUrl: photo }]);
    expect(candidatesFromSearch("<html>")).toEqual([]);
    expect(candidatesFromSearch({ products: "nope" })).toEqual([]);
  });

  it("reads a product by barcode, or nothing", () => {
    expect(candidateFromProduct({ status: 1, product: { code: "8901725016838", product_name_en: "Atta", image_front_url: photo } })?.name).toBe("Atta");
    expect(candidateFromProduct({ status: 0 })).toBeNull();
    expect(candidateFromProduct(null)).toBeNull();
  });

  it("searches India only, with a bounded query", () => {
    const url = new URL(searchUrl("https://world.openfoodfacts.org", "x".repeat(500)));
    expect(url.pathname).toBe("/cgi/search.pl");
    expect(url.searchParams.get("tag_0")).toBe("india");
    expect(url.searchParams.get("search_terms")).toHaveLength(120);
  });
});

describe("requests", () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("retries a rate limit once, then succeeds", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("slow down", { status: 429 })).mockResolvedValueOnce(json({ ok: 1 }));
    expect(await getJson("https://world.openfoodfacts.org/x", { fetcher, tries: 2 })).toEqual({ ok: 1 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("gives up after its tries on errors or an HTML page", async () => {
    const html = new Response("<html>", { status: 200, headers: { "content-type": "text/html" } });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("", { status: 503 })).mockResolvedValueOnce(html);
    await expect(getJson("https://world.openfoodfacts.org/x", { fetcher, tries: 2 })).rejects.toThrow("not JSON");
    const down = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    await expect(getJson("https://world.openfoodfacts.org/x", { fetcher: down, tries: 2 })).rejects.toThrow("fetch failed");
    expect(down).toHaveBeenCalledTimes(2);
  });

  it("reads a missing product as nothing", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 404 }));
    expect(await getJson("https://world.openfoodfacts.org/x", { fetcher })).toBeNull();
  });
});
