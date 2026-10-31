import { expect, test, type Page } from "@playwright/test";

import { blockingViolations, darkMode, localSupabase, signInToDemo } from "./support";

// F-14 review gate: the privacy page says where data lives (Seoul, errata
// E-28) and how long each kind is kept, in Hindi and English, and is linked
// from sign-in, the storefront, the review page and My shop.

async function expectEnglish(page: Page) {
  await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
  await expect(page.getByText("Everything we keep is stored with Supabase in Seoul, South Korea. It is not stored in India.")).toBeVisible();
  const owners = page.getByRole("region", { name: "If you run a shop" });
  await expect(owners.getByRole("listitem").filter({ hasText: "Voice notes" })).toContainText("Audio 7 days, words 90 days");
  const customers = page.getByRole("region", { name: "If you visit a shop or leave a review" });
  await expect(customers.getByRole("listitem").filter({ hasText: "Voice reviews" })).toContainText("Audio 30 days");
  await expect(customers.getByRole("listitem").filter({ hasText: "Your internet address" })).toContainText("7 days");
}

test("the privacy page says where data is kept and for how long", async ({ page }) => {
  const res = await page.goto("/privacy?lang=en");
  expect(res!.status()).toBe(200);
  await expectEnglish(page);
  const issues = page.getByRole("link", { name: "Open an issue on GitHub" });
  await expect(issues).toHaveAttribute("href", "https://github.com/Stonebanks-js/ShelfVoice-AI/issues");
  await expect(issues).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.getByText(/Issues are public/)).toBeVisible();
  expect(await blockingViolations(page)).toEqual([]);
  await darkMode(page);
  expect(await blockingViolations(page)).toEqual([]);
});

test("the privacy page reads in Hindi, from the link or the switch", async ({ page }) => {
  await page.goto("/privacy?lang=hi");
  await expect(page.getByRole("heading", { level: 1, name: "गोपनीयता" })).toBeVisible();
  await expect(page.getByText(/सियोल, दक्षिण कोरिया/)).toBeVisible();
  await expect(page.locator("main").locator("xpath=ancestor-or-self::*[@lang][1]")).toHaveAttribute("lang", "hi");
  expect(await blockingViolations(page)).toEqual([]);

  await page.getByRole("radio", { name: "English" }).click();
  await expectEnglish(page);
});

test("sign-in links to the privacy page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "English" }).click();
  await page.getByRole("link", { name: "Privacy" }).click();
  await page.waitForURL("/privacy?lang=en");
  await expectEnglish(page);
});

test.describe("with the local stack", () => {
  test.skip(!localSupabase, "needs the local Supabase stack");

  test("the storefront, the review page and My shop link to it", async ({ page, context }) => {
    await signInToDemo(page);
    const { shop } = await page.evaluate(() => fetch("/api/v1/shops/me").then((r) => r.json() as Promise<{ shop: { slug: string } }>));
    await page.goto("/app/shop");
    await expect(page.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy?lang=en");

    await context.clearCookies();
    await page.goto(`/s/${shop.slug}`);
    await page.getByRole("link", { name: "Privacy" }).click();
    await page.waitForURL("/privacy?lang=en#customers");
    await expectEnglish(page);

    await page.goto(`/r/${shop.slug}`);
    await page.getByRole("link", { name: "How we handle your voice note" }).click();
    await page.waitForURL("/privacy?lang=en#customers");
    await expectEnglish(page);
  });
});
