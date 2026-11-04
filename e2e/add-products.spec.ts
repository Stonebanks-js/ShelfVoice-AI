import { expect, test, type Page } from "@playwright/test";

import { blockingViolations, darkMode, localAdmin, localSupabase, signInAsNewOwner } from "./support";

// Adding many products without speaking each one: the
// ready-made list, an Excel or CSV file, barcodes typed in (Open Food Facts
// is off in tests, so every code is new), and a shelf photo whose reader is
// replaced with a proposal written to the database (no AI credit spent).

test.skip(!localSupabase, "needs the local Supabase stack");

async function newShop(page: Page) {
  const userId = await signInAsNewOwner(page);
  const { data: shop } = await localAdmin().from("shops").select("id").eq("owner_id", userId).single();
  return shop!.id;
}

const products = async (shopId: string) =>
  (await localAdmin().from("products").select("name, unit, price_paise, stock_qty, category, barcode").eq("shop_id", shopId).is("archived_at", null).order("name")).data!;

test("a ready-made list adds ticked products, with prices the owner fixed", async ({ page }) => {
  const shopId = await newShop(page);
  await page.goto("/app");
  await page.getByRole("link", { name: "Build your shop" }).click();
  await expect(page).toHaveURL("/app/setup");
  await expect(page.getByRole("heading", { level: 1, name: "Add your products" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main sections" })).toBeHidden();
  expect(await blockingViolations(page)).toEqual([]);

  await page.getByRole("link", { name: /^Ready-made list/ }).click();
  await expect(page.getByRole("button", { name: "Kirana", pressed: true })).toBeVisible();
  expect(await blockingViolations(page)).toEqual([]);

  await page.getByRole("button", { name: "Add Tata Salt 1 kg" }).click();
  await expect(page.getByRole("button", { name: "Added Tata Salt 1 kg" })).toHaveAttribute("aria-pressed", "true");
  // Typing a price ticks the product too.
  await page.getByRole("textbox", { name: "Price of Parle-G 80 g" }).fill("12");
  await expect(page.getByRole("button", { name: "Added Parle-G 80 g" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("searchbox", { name: "Search products" }).fill("namak");
  await expect(page.getByRole("button", { name: "Add Aashirvaad Salt 1 kg" })).toBeHidden(); // departmental only
  await page.getByRole("button", { name: "Clear search" }).click();

  // Ticks stay when the owner looks at another list.
  await page.getByRole("button", { name: "Pan shop", pressed: false }).click();
  await page.getByRole("button", { name: "Add Pass Pass 1 pc" }).click();
  await darkMode(page);
  expect(await blockingViolations(page)).toEqual([]);
  await page.getByRole("button", { name: "Add 3 products" }).click();

  await expect(page).toHaveURL("/app/stock", { timeout: 15_000 });
  await expect(page.getByText("3 products added")).toBeVisible();
  expect(await products(shopId)).toEqual([
    { name: "Parle-G", unit: "80 g", price_paise: 1200, stock_qty: null, category: "Biscuits", barcode: null },
    { name: "Pass Pass", unit: "1 pc", price_paise: 200, stock_qty: null, category: "Chocolates", barcode: null },
    { name: "Tata Salt", unit: "1 kg", price_paise: 2800, stock_qty: null, category: "Staples", barcode: null },
  ]);

  // Back on the list, what the shop has can't be added twice.
  await page.goto("/app/add/list");
  await expect(page.getByText("1 kg · In your shop")).toBeVisible();
  await expect(page.getByRole("button", { name: /Tata Salt 1 kg/ })).toBeHidden();
});

test("an Excel or CSV file from a billing app becomes products", async ({ page }) => {
  const shopId = await newShop(page);
  await page.goto("/app/add");
  await page.getByRole("link", { name: /^Excel or CSV file/ }).click();
  await expect(page.getByRole("link", { name: "Download sample sheet" })).toHaveAttribute("download", "shelf-voice-products.csv");
  expect(await blockingViolations(page)).toEqual([]);

  const input = page.locator('input[type="file"]');
  await input.setInputFiles({ name: "broken.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from("PK not really a zip") });
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("This file couldn't be read. Save it as .xlsx or .csv and try again.");

  await input.setInputFiles({
    name: "items.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Sharma Kirana stock\nItem Name,Rate,MRP,Closing Stock\nTata Salt,24,28,20\nSurf Excel 1kg,130,145,6\nTotal,,,26\n"),
  });
  await expect(page.getByText("2 products found in items.csv")).toBeVisible();
  await expect(page.getByText(/Read: name, price, stock/)).toBeVisible();
  expect(await blockingViolations(page)).toEqual([]);
  await page.getByRole("button", { name: "Added Surf Excel 1kg" }).click();
  await expect(page.getByRole("button", { name: "Add Surf Excel 1kg" })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Add 1 product" }).click();

  await expect(page).toHaveURL("/app/stock", { timeout: 15_000 });
  expect(await products(shopId)).toEqual([{ name: "Tata Salt", unit: null, price_paise: 2800, stock_qty: 20, category: null, barcode: null }]);
});

test("a barcode is named once, then found again to log a delivery", async ({ page }) => {
  const shopId = await newShop(page);
  const code = `89${String(Date.now()).slice(-11)}`;
  await page.goto("/app/add/scan");
  await expect(page.getByRole("heading", { level: 1, name: "Scan barcodes" })).toBeVisible();
  expect(await blockingViolations(page)).toEqual([]);

  const number = page.getByRole("textbox", { name: "Barcode number" });
  await number.fill("12345");
  await page.getByRole("button", { name: "Find" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("That isn't a barcode number. It has 8 to 14 digits.");

  await number.fill(code);
  await page.getByRole("button", { name: "Find" }).click();
  const sheet = page.getByRole("dialog", { name: "New product" });
  await expect(sheet.getByText("We don't know this barcode yet. Type the name once and your shop will remember it.")).toBeVisible();
  await sheet.getByRole("textbox", { name: "Name" }).fill("Ghar Ka Achar");
  await sheet.getByRole("textbox", { name: "Price (₹)" }).fill("80");
  await sheet.getByRole("button", { name: "More stock of Ghar Ka Achar" }).click();
  await sheet.getByRole("button", { name: "More stock of Ghar Ka Achar" }).click();
  expect(await blockingViolations(page)).toEqual([]);
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Ghar Ka Achar saved")).toBeVisible();
  await expect(page.getByText("1 saved this time")).toBeVisible();

  await number.fill(code);
  await page.getByRole("button", { name: "Find" }).click();
  const known = page.getByRole("dialog", { name: "Already in your shop" });
  await expect(known.getByText("Ghar Ka Achar")).toBeVisible();
  await known.getByRole("button", { name: "More stock of Ghar Ka Achar" }).click();
  await known.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("2 saved this time")).toBeVisible();

  await page.getByRole("button", { name: "Done" }).click();
  await expect(page).toHaveURL("/app/stock", { timeout: 15_000 });
  expect(await products(shopId)).toEqual([{ name: "Ghar Ka Achar", unit: null, price_paise: 8000, stock_qty: 4, category: null, barcode: code }]);
});

test("a shelf photo lists new products with price and stock set on each card", async ({ page }) => {
  const shopId = await newShop(page);
  const { data: proposal } = await localAdmin()
    .from("proposals")
    .insert({
      shop_id: shopId,
      kind: "SHELF",
      changes: [
        { op: "add_product", name: "Parle-G", unit: "80 g", category: "Biscuits", price_paise: 1000, aliases: ["parle"] },
        { op: "add_product", name: "Local Namkeen", unit: null, category: null, price_paise: null },
      ],
    })
    .select("id")
    .single();
  let uploadedPath = "";
  await page.route("**/api/v1/proposals/shelf", async (route) => {
    uploadedPath = (route.request().postDataJSON() as { path: string }).path;
    await route.fulfill({ status: 201, json: { proposal: { id: proposal!.id } } });
  });

  await page.goto("/app/add");
  await page.getByRole("link", { name: /^Shelf photo/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Photo of a shelf" })).toBeVisible();
  expect(await blockingViolations(page)).toEqual([]);
  const photo = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    canvas.getContext("2d")!.fillRect(0, 0, 800, 600);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg"));
    return [...new Uint8Array(await blob.arrayBuffer())];
  });
  await page.locator('input[type="file"]:not([capture])').setInputFiles({ name: "shelf.jpg", mimeType: "image/jpeg", buffer: Buffer.from(photo) });
  await page.getByRole("button", { name: "Use photo" }).click();

  await expect(page).toHaveURL(`/app/check/${proposal!.id}`, { timeout: 20_000 });
  expect(uploadedPath.startsWith(`${shopId}/shelf/`)).toBe(true);
  await expect(page.getByRole("textbox", { name: "Price of Parle-G" })).toHaveValue("10");
  await expect(page.getByRole("checkbox", { name: "Include this change: Add Parle-G" })).toHaveAttribute("aria-checked", "true");
  // No price yet: not picked until the owner gives one.
  const namkeen = page.getByRole("checkbox", { name: "Include this change: Add Local Namkeen" });
  await expect(namkeen).toHaveAttribute("aria-checked", "false");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "More stock of Parle-G" }).click();
  await page.getByRole("textbox", { name: "Price of Local Namkeen" }).fill("25");
  await expect(namkeen).toHaveAttribute("aria-checked", "true");
  expect(await blockingViolations(page)).toEqual([]);
  await page.getByRole("button", { name: "Confirm 2 changes" }).click();

  await expect(page).toHaveURL("/app", { timeout: 20_000 });
  expect(await products(shopId)).toEqual([
    { name: "Local Namkeen", unit: null, price_paise: 2500, stock_qty: null, category: null, barcode: null },
    { name: "Parle-G", unit: "80 g", price_paise: 1000, stock_qty: 3, category: "Biscuits", barcode: null },
  ]);
});
