import { describe, expect, it } from "vitest";

import { catalogKey, productPhoto } from "./catalog/photo-url";
import { discountPercent } from "./price";

describe("discount", () => {
  it("comes only from the shop's price and the owner's MRP, rounded down", () => {
    expect(discountPercent(27500, 31000)).toBe(11);
    expect(discountPercent(2800, 2800)).toBeNull();
    expect(discountPercent(3000, 2800)).toBeNull();
    expect(discountPercent(null, 2800)).toBeNull();
    expect(discountPercent(2800, null)).toBeNull();
    expect(discountPercent(9950, 10000)).toBeNull(); // under 1%: not worth a badge
  });
});

describe("product photo", () => {
  const supabase = "https://abc.supabase.co";
  const shop = "aaaaaaaa-1111-0000-0000-000000000001";
  const product = "aaaaaaaa-1111-0000-0000-000000000011";

  it("uses the owner's stored photo from their own folder", () => {
    expect(productPhoto({ imagePath: `${shop}/${product}-1730000000000.webp`, imageCredit: "OFF", name: "Tata Salt", unit: "1 kg" }, supabase)).toEqual({
      url: `${supabase}/storage/v1/object/public/catalog-images/${shop}/${product}-1730000000000.webp`,
      credit: "OFF",
    });
  });

  it("ignores a stored value of any other shape", () => {
    expect(productPhoto({ imagePath: "https://evil.example/a.jpg", name: "Unlisted thing", unit: "1 kg" }, supabase)).toBeNull();
    expect(productPhoto({ imagePath: "../../secret.jpg", name: "Unlisted thing" }, supabase)).toBeNull();
  });

  it("keys the ready-made list by name and pack, ignoring case and spaces", () => {
    expect(catalogKey(" Tata Salt ", "1 kg")).toBe("tata salt|1 kg");
    expect(catalogKey("Tata Salt", null)).toBe("tata salt|");
  });
});
