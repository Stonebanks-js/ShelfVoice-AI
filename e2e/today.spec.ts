import { expect, test } from "@playwright/test";

import { blockingViolations, localSupabase, ownTestAddress, signInAsNewOwner, signInToDemo } from "./support";

// F-05 review gate: Today (O-5) with the demo shop's real numbers, both
// languages, both themes, and a new shop with nothing in it yet.

test.skip(!localSupabase, "needs the local Supabase stack");

test("shows today's sales, what's running low and new reviews", async ({ page }) => {
  await signInToDemo(page);
  await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();

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
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await blockingViolations(page)).toEqual([]);

  await firstLow.click();
  await expect(page).toHaveURL("/app/orders");
  await page.goBack();
  await page.getByRole("link", { name: "Sharma Kirana Store" }).click();
  await expect(page).toHaveURL("/app/shop");
});

test("reads in Hindi for a Hindi shop", async ({ page, context }) => {
  await ownTestAddress(page);
  await context.clearCookies();
  await page.goto("/");
  await page.getByRole("radio", { name: "हिन्दी" }).click();
  await page.getByRole("button", { name: "डेमो दुकान देखें" }).click();
  await page.waitForURL("/app");
  await expect(page.getByRole("heading", { level: 1, name: "आज" })).toBeVisible();
  await expect(page.getByRole("region", { name: "आज की बिक्री" })).toContainText(/\d+ सामान बिके/);
  await expect(page.getByRole("heading", { name: /कम बचा है/ })).toBeVisible();
  expect(await blockingViolations(page)).toEqual([]);
});

test("a new shop with no products is invited to set up by voice", async ({ page }) => {
  await signInAsNewOwner(page);
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Set up your shop by voice" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Sales today" })).toBeHidden();
  await page.getByRole("link", { name: "Start setup" }).click();
  await expect(page).toHaveURL("/app/setup");
});

test("no sideways scroll on a 320 px phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await signInToDemo(page);
  await expect(page.getByRole("region", { name: "Sales today" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
