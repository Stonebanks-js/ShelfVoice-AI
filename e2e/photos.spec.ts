import { expect, test, type Page } from "@playwright/test";

import { blockingViolations, darkMode, localAdmin, localSupabase, signInToSampleShop } from "./support";

// An owner enters the MRP from the pack; customers see the
// shop's own price, the MRP and a discount worked out from the two, with the
// ready-made list's checked photo; with photo search off (as in every test
// run) the owner is told so and the product works the same; a broken photo
// falls back to the drawn tile; cart and checkout carry on as before.

test.skip(!localSupabase, "needs the local Supabase stack");

async function openStock(page: Page) {
  await signInToSampleShop(page);
  const { shop } = await page.evaluate(() => fetch("/api/v1/shops/me").then((r) => r.json() as Promise<{ shop: { id: string; slug: string } }>));
  await page.goto("/app/stock");
  await expect(page.getByRole("heading", { level: 1, name: "Stock" })).toBeVisible();
  return shop;
}

// A product card, found by its heart button, which stays whatever is in the cart.
const card = (page: Page, name: string) => page.getByRole("listitem").filter({ has: page.getByRole("button", { name: `Save ${name}`, exact: true }) });

test("an owner's MRP becomes a discount customers see, beside the product's photo", async ({ page, context }) => {
  const shop = await openStock(page);

  await page.getByRole("button", { name: /^Tata Salt/ }).click();
  const sheet = page.getByRole("dialog", { name: "Edit product" });
  await sheet.getByLabel("Price (₹)").fill("25");
  await sheet.getByLabel("MRP (₹)").fill("30");
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  const { data } = await localAdmin().from("products").select("price_paise, mrp_paise").eq("shop_id", shop.id).eq("name", "Tata Salt").single();
  expect(data).toEqual({ price_paise: 2500, mrp_paise: 3000 });

  // Photo search is off in tests: the owner hears so, and nothing changes.
  await page.getByRole("button", { name: /^Tata Salt/ }).click();
  await sheet.getByRole("button", { name: "Find a photo" }).click();
  await expect(sheet.getByRole("status")).toHaveText(/Photo search isn't available right now/);
  await sheet.getByRole("button", { name: "Cancel" }).click();

  await context.clearCookies();
  await page.goto(`/s/${shop.slug}`);
  const salt = card(page, "Tata Salt");
  await expect(salt).toContainText("₹25");
  await expect(salt).toContainText("16% off"); // (30 − 25) / 30, rounded down
  await expect(salt.locator("s")).toHaveText("₹30");
  await expect(salt.locator("img")).toHaveAttribute("src", /^\/catalog\/tata-salt-1-kg\.webp$/);
  await expect(page.getByRole("link", { name: /Product photos: Open Food Facts contributors/ })).toBeVisible();
  // No MRP, no discount: Maggi shows only its price.
  await expect(card(page, "Maggi 2-Minute Noodles")).not.toContainText("% off");
  expect(await blockingViolations(page)).toEqual([]);
  await darkMode(page);
  expect(await blockingViolations(page)).toEqual([]);

  // The cart carries the shop's price, and quantities still change.
  await salt.getByRole("button", { name: /^Add/ }).click();
  await salt.getByRole("button", { name: "One more Tata Salt" }).click();
  await page.getByRole("button", { name: /View cart/ }).click();
  const cart = page.getByRole("dialog", { name: "Your order" });
  await expect(cart).toContainText("₹50");
  await expect(cart.getByRole("button", { name: /Place order/ })).toBeVisible();
});

test("a photo that won't load falls back to the drawn tile", async ({ page, context }) => {
  const shop = await openStock(page);
  await context.clearCookies();
  await page.route("**/catalog/*.webp", (route) => route.fulfill({ status: 404, body: "" }));
  await page.goto(`/s/${shop.slug}`);
  const salt = card(page, "Tata Salt");
  await expect(salt.locator("img")).toHaveCount(0);
  await expect(salt.getByRole("button", { name: /^Add/ })).toBeVisible();
});
