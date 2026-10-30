import { expect, test, type Page } from "@playwright/test";

import { blockingViolations, darkMode, localAdmin, localSupabase, signInToDemo } from "./support";

// F-09 review gate: My shop (O-9) against the local database: preview,
// publish, review QR, details, hours, language, sign out and delete.

test.skip(!localSupabase, "needs the local Supabase stack");

async function openShop(page: Page) {
  await signInToDemo(page);
  const { shop, user } = await page.evaluate(() =>
    fetch("/api/v1/shops/me").then((r) => r.json() as Promise<{ shop: { id: string; slug: string }; user: { id: string } }>),
  );
  await page.getByRole("link", { name: "Sharma Kirana Store" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "My shop" })).toBeVisible();
  return { shopId: shop.id, slug: shop.slug, userId: user.id };
}

const shopRow = (id: string) => localAdmin().from("shops").select("*").eq("id", id).maybeSingle();

test("preview, publish switch and accessibility", async ({ page }) => {
  const { shopId } = await openShop(page);
  const preview = page.getByRole("region", { name: "Shop page" });
  await expect(preview.getByRole("heading", { name: "Sharma Kirana Store" })).toBeVisible();
  await expect(preview).toContainText(/Open now, closes|Closed, opens/);
  await expect(page.getByText("This is a demo shop.")).toBeVisible();
  expect(await blockingViolations(page)).toEqual([]);
  await darkMode(page);
  expect(await blockingViolations(page)).toEqual([]);

  await page.getByRole("switch", { name: "Show my shop to customers" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your shop page is hidden" })).toBeVisible();
  await expect.poll(async () => (await shopRow(shopId)).data?.is_published).toBe(false);
});

test("the review QR points at the shop's review page and downloads", async ({ page }) => {
  const { slug } = await openShop(page);
  await page.getByRole("button", { name: "Review QR for the counter" }).click();
  const sheet = page.getByRole("dialog", { name: "Leave a voice review" });
  const qr = sheet.getByRole("img");
  await expect(qr).toBeVisible();
  expect((await qr.getAttribute("aria-label"))?.endsWith(`/r/${slug}`)).toBe(true);
  const download = page.waitForEvent("download");
  await sheet.getByRole("button", { name: "Download to print" }).click();
  expect((await download).suggestedFilename()).toBe("shelf-voice-review-qr.png");
});

test("details and hours save", async ({ page }) => {
  const { shopId } = await openShop(page);
  await page.getByRole("button", { name: /^Phone/ }).click();
  let sheet = page.getByRole("dialog", { name: "Edit details" });
  await sheet.getByLabel("Phone (10 digits)").fill("12345");
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet.getByText("One of the changes isn't valid. Please check it.")).toBeVisible();
  await sheet.getByLabel("Phone (10 digits)").fill("98765 00000");
  await sheet.getByLabel("Address").fill("Near the bus stand, Meerut");
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: /Phone/ })).toContainText("+91 98765 00000");
  expect((await shopRow(shopId)).data).toMatchObject({ phone: "+919876500000", address: "Near the bus stand, Meerut" });

  await page.getByRole("button", { name: /Mon – Sun/ }).click();
  sheet = page.getByRole("dialog", { name: "Edit hours" });
  await sheet.getByRole("switch", { name: "Sunday" }).click();
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: /^Sun/ })).toContainText("Closed");
  expect((await shopRow(shopId)).data?.hours).toMatchObject({ sun: [], mon: [["07:00", "22:00"]] });
});

test("switching to Hindi saves the shop's language", async ({ page }) => {
  const { shopId } = await openShop(page);
  await page.getByRole("radio", { name: "हिन्दी" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "मेरी दुकान" })).toBeVisible();
  await expect.poll(async () => (await shopRow(shopId)).data?.language).toBe("hi");
});

test("sign out returns to sign-in", async ({ page }) => {
  await openShop(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/app");
  await expect(page).toHaveURL("/");
});

test("delete my shop removes it and the account", async ({ page }) => {
  const { shopId, userId } = await openShop(page);
  await page.getByRole("button", { name: "Delete my shop" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Delete your shop?" });
  await expect(confirm).toContainText("can't be undone");
  await confirm.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL("/");
  expect((await shopRow(shopId)).data).toBeNull();
  expect((await localAdmin().auth.admin.getUserById(userId)).data.user).toBeNull();
});
