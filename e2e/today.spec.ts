import { expect, test } from "@playwright/test";

import { blockingViolations, darkMode, localSupabase, signInAsNewOwner, signInToSampleShop } from "./support";

// F-05 review gate: Home (O-5, reshaped by V-02) with the sample shop's real
// numbers, both languages, both themes, and a new shop with nothing in it yet.

test.skip(!localSupabase, "needs the local Supabase stack");

test("shows today's sales, what's running low and new reviews", async ({ page }) => {
  await signInToSampleShop(page);
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  // The shop comes first, with ways to see it, share it and change it.
  const shop = page.getByRole("region", { name: "Sharma Kirana Store" });
  await expect(shop).toContainText(/Customers can see your shop\s*· 15 products/);
  await expect(shop.getByRole("link", { name: "View" })).toHaveAttribute("href", /^\/s\/.+/);
  await expect(shop.getByRole("button", { name: "Share" })).toBeVisible();
  await expect(shop.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/app/shop");
  await expect(page.getByRole("heading", { name: "Recent changes" })).toBeVisible();

  const sales = page.getByRole("region", { name: "Sales today" });
  await expect(sales).toContainText(/₹[\d,]+/);
  await expect(sales).toContainText(/\d+ items sold/);

  // The demo's atta is flagged by a customer, so it leads the list.
  await expect(page.getByRole("heading", { name: /Running low · \d+/ })).toBeVisible();
  const firstLow = page.getByRole("link", { name: /Aashirvaad Atta/ });
  await expect(firstLow).toContainText("Customers asked");
  await expect(page.getByRole("heading", { name: /Customer reviews · 2 this week/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Atta was out of stock yesterday/ })).toContainText("Unhappy");

  expect(await blockingViolations(page)).toEqual([]);
  await darkMode(page);
  expect(await blockingViolations(page)).toEqual([]);

  await firstLow.click();
  await expect(page).toHaveURL("/app/orders");
  await page.goBack();
  await page.getByRole("link", { name: "Sharma Kirana Store" }).click();
  await expect(page).toHaveURL("/app/shop");
});

test("reads in Hindi for a Hindi shop", async ({ page, context }) => {
  await context.clearCookies();
  await signInToSampleShop(page, "hi");
  await expect(page.getByRole("heading", { level: 1, name: "होम" })).toBeVisible();
  await expect(page.getByRole("region", { name: "आज की बिक्री" })).toContainText(/\d+ सामान बिके/);
  await expect(page.getByRole("heading", { name: /कम बचा है/ })).toBeVisible();
  expect(await blockingViolations(page)).toEqual([]);
});

test("a new shop with no products is invited to build it", async ({ page }) => {
  await signInAsNewOwner(page);
  await page.goto("/app");
  await expect(page.getByRole("region", { name: "New Kirana" })).toContainText("Your shop is hidden from customers");
  await expect(page.getByRole("region", { name: "Sales today" })).toBeHidden();
  await page.getByRole("link", { name: "Build your shop" }).click();
  await expect(page).toHaveURL("/app/setup");
});

test("no sideways scroll on a 320 px phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await signInToSampleShop(page);
  await expect(page.getByRole("region", { name: "Sales today" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
