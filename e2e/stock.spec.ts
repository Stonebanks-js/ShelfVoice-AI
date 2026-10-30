import { expect, test, type Page } from "@playwright/test";

import { blockingViolations, darkMode, localAdmin, localSupabase, signInAsNewOwner, signInToDemo } from "./support";

// F-06 review gate: the Stock tab (O-6) against the local database: search,
// chips, the in/out switch, edits by tap (price, count as a correction),
// adding and removing products, and the empty shop.

test.skip(!localSupabase, "needs the local Supabase stack");

async function openStock(page: Page) {
  await signInToDemo(page);
  const { shop } = await page.evaluate(() => fetch("/api/v1/shops/me").then((r) => r.json() as Promise<{ shop: { id: string } }>));
  await page.getByRole("navigation", { name: "Main sections" }).getByRole("link", { name: "Stock" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Stock" })).toBeVisible();
  return shop.id;
}

const product = (shopId: string, prefix: string) =>
  localAdmin().from("products").select("id, price_paise, stock_qty, is_in_stock, archived_at").eq("shop_id", shopId).like("name", `${prefix}%`).single();

test("search, chips and accessibility", async ({ page }) => {
  await openStock(page);
  await expect(page.getByText("15 products")).toBeVisible();
  expect(await blockingViolations(page)).toEqual([]);
  await darkMode(page);
  expect(await blockingViolations(page)).toEqual([]);

  await page.getByRole("searchbox", { name: "Search products" }).fill("atta");
  await expect(page.getByRole("button", { name: /Aashirvaad Atta/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Maggi/ })).toBeHidden();
  await page.getByRole("button", { name: "Clear search" }).click();

  await page.getByRole("button", { name: "Dairy", pressed: false }).click();
  await expect(page.getByRole("heading", { name: "Dairy" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Staples" })).toBeHidden();
});

test("the switch marks a product out of stock", async ({ page }) => {
  const shopId = await openStock(page);
  await page.getByRole("switch", { name: /Maggi.* in stock/ }).click();
  await expect(page.getByRole("switch", { name: /Maggi.* in stock/ })).toHaveAttribute("aria-checked", "false");
  await expect.poll(async () => (await product(shopId, "Maggi")).data?.is_in_stock).toBe(false);
  await page.getByRole("button", { name: "Out of stock", exact: true }).click();
  await expect(page.getByRole("button", { name: /Maggi/ })).toContainText("Out of stock");
});

test("a tap edit changes the price and records the count as a correction", async ({ page }) => {
  const shopId = await openStock(page);
  const before = (await product(shopId, "Maggi")).data!;
  await page.getByRole("button", { name: /Maggi/ }).click();
  const sheet = page.getByRole("dialog", { name: "Edit product" });
  await sheet.getByLabel("Price (₹)").fill("16");
  await sheet.getByRole("button", { name: "One more" }).click();
  await sheet.getByRole("button", { name: "One more" }).click();
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

  const after = (await product(shopId, "Maggi")).data!;
  expect(after.price_paise).toBe(1600);
  expect(after.stock_qty).toBe(before.stock_qty! + 2);
  const { data: moves } = await localAdmin().from("stock_movements").select("kind, qty, source").eq("product_id", after.id).eq("source", "TAP");
  expect(moves).toEqual([{ kind: "CORRECTION", qty: 2, source: "TAP" }]);
  await expect(page.getByRole("button", { name: /Maggi/ })).toContainText("₹16");
});

test("a wild price is refused with a reason", async ({ page }) => {
  await openStock(page);
  await page.getByRole("button", { name: /Maggi/ }).click();
  const sheet = page.getByRole("dialog", { name: "Edit product" });
  await sheet.getByLabel("Price (₹)").fill("9999");
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("That price looks wrong. Please check it.");
});

test("add a product by tap, then remove it", async ({ page }) => {
  const shopId = await openStock(page);
  await page.getByRole("button", { name: "Add" }).click();
  const sheet = page.getByRole("dialog", { name: "New product" });
  await sheet.getByLabel("Name").fill("Tata Tea Gold");
  await sheet.getByLabel("Price (₹)").fill("120");
  await sheet.getByLabel("Unit (like 1 kg, 500 g)").fill("250 g");
  await sheet.getByLabel("Count on the shelf").fill("10");
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Tata Tea Gold added" })).toBeVisible();
  const row = page.getByRole("button", { name: /Tata Tea Gold/ });
  await expect(row).toContainText("₹120 · 250 g");
  expect((await product(shopId, "Tata Tea Gold")).data).toMatchObject({ price_paise: 12_000, stock_qty: 10 });

  await row.click();
  await page.getByRole("dialog", { name: "Edit product" }).getByRole("button", { name: "Remove product" }).click();
  await page.getByRole("alertdialog", { name: "Remove Tata Tea Gold?" }).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Removed" })).toBeVisible();
  await expect(row).toBeHidden();
  // Archived, not deleted: its history stays for the forecast.
  expect((await product(shopId, "Tata Tea Gold")).data?.archived_at).not.toBeNull();
});

test("an empty shop is asked what it sells", async ({ page }) => {
  await signInAsNewOwner(page);
  await page.goto("/app/stock");
  await expect(page.getByRole("heading", { name: "Your shop has no products yet" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tell us by voice" })).toHaveAttribute("href", "/app/setup");
});

test("a confirmed voice change shows up on the Stock row", async ({ page }) => {
  const shopId = await openStock(page);
  const maggi = (await product(shopId, "Maggi")).data!;
  const { data: proposal } = await localAdmin()
    .from("proposals")
    .insert({ shop_id: shopId, kind: "COMMAND", transcript: "Maggi ke 77 packet hain", changes: [{ op: "set_stock_count", product_id: maggi.id, count: 77 }] })
    .select("id")
    .single();
  await page.goto(`/app/check/${proposal!.id}`);
  await page.getByRole("button", { name: "Confirm 1 change" }).click();
  await expect(page).toHaveURL("/app");
  await page.getByRole("navigation", { name: "Main sections" }).getByRole("link", { name: "Stock" }).click();
  await expect(page.getByRole("button", { name: /Maggi/ })).toContainText("77");
});
