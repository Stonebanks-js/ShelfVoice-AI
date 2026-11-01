import { expect, test } from "@playwright/test";

import { blockingViolations, chooseLanguage, localAdmin, localSupabase, signInToSampleShop } from "./support";

// V-06 review gate: eleven languages. The picker switches every screen; a
// visitor from Karnataka is asked whether they want Kannada (Vercel's IP
// region headers, faked here); an owner's choice is saved with the shop.

test("the picker switches the first screen to Kannada, and it stays", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/");
  await chooseLanguage(page, "ಕನ್ನಡ");
  await expect(page.getByRole("heading", { name: "ನೀವು ಯಾರು?" })).toBeVisible();
  await expect(page.locator('div.contents[lang="kn"]').first()).toBeAttached();
  expect(await blockingViolations(page)).toEqual([]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "ನೀವು ಯಾರು?" })).toBeVisible();
  await chooseLanguage(page, "English");
  await expect(page.getByRole("heading", { name: "Who are you?" })).toBeVisible();
});

test("a visitor in Karnataka is asked about Kannada, once", async ({ browser }) => {
  const context = await browser.newContext({ extraHTTPHeaders: { "x-vercel-ip-country": "IN", "x-vercel-ip-country-region": "KA" }, locale: "en-IN" });
  const page = await context.newPage();
  try {
    await page.goto("/");
    const ask = page.getByRole("region", { name: "You seem to be in Karnataka. Which language do you want?" });
    await expect(ask).toBeVisible();
    await expect(ask.locator('p[lang="kn"]')).toBeVisible(); // the question again, in Kannada
    expect(await blockingViolations(page)).toEqual([]);
    await ask.getByRole("button", { name: "ಕನ್ನಡ" }).click();
    await expect(page.getByRole("heading", { name: "ನೀವು ಯಾರು?" })).toBeVisible();
    await page.reload();
    await expect(page.locator("#lang-suggest")).toHaveCount(0); // chosen: not asked again
  } finally {
    await context.close();
  }
});

test("an owner's language is saved with the shop", async ({ page }) => {
  test.skip(!localSupabase, "needs the local Supabase stack");
  await signInToSampleShop(page);
  const { shop } = await page.evaluate(() => fetch("/api/v1/shops/me").then((r) => r.json() as Promise<{ shop: { id: string } }>));
  await page.goto("/app/shop");
  await page.getByRole("button", { name: /^Language/ }).click();
  await page.getByRole("dialog", { name: "Language" }).getByRole("radio", { name: "ಕನ್ನಡ" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "ನನ್ನ ಅಂಗಡಿ" })).toBeVisible();
  await expect.poll(async () => (await localAdmin().from("shops").select("language").eq("id", shop.id).single()).data?.language).toBe("kn");
  expect(await blockingViolations(page)).toEqual([]);
  // The owner app opens in Kannada next time too.
  await page.goto("/app");
  await expect(page.locator('div.contents[lang="kn"]').first()).toBeAttached();
});
