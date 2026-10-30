import { expect, test, type Page } from "@playwright/test";

import { blockingViolations, darkMode, localAdmin, localSupabase, signInAsNewOwner, signInToDemo } from "./support";

// F-08 review gate: the review feed (O-8) against the local database:
// sentiment, words, item chips, Hide and Show, filters, the 30-day audio.

test.skip(!localSupabase, "needs the local Supabase stack");

async function openReviews(page: Page) {
  await signInToDemo(page);
  const { shop } = await page.evaluate(() => fetch("/api/v1/shops/me").then((r) => r.json() as Promise<{ shop: { id: string } }>));
  await page.getByRole("navigation", { name: "Main sections" }).getByRole("link", { name: "Reviews" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Reviews" })).toBeVisible();
  return shop.id;
}

// A one-second 16 kHz WAV, as a customer's review would be stored.
function tone(): Buffer {
  const n = 16_000;
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16_000, 24); b.writeUInt32LE(32_000, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / 16_000)), 44 + i * 2);
  return b;
}

test("the feed shows what customers said, newest first", async ({ page }) => {
  await openReviews(page);
  const cards = page.getByRole("main").getByRole("listitem").filter({ has: page.getByRole("button", { name: "Hide" }) });
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText("Unhappy");
  await expect(cards.first()).toContainText("Atta was out of stock yesterday.");
  await expect(cards.first()).toContainText("Kal atta lene aaya tha");
  await expect(cards.first().getByText("Aashirvaad Atta: wanted, out of stock")).toBeVisible();
  expect(await blockingViolations(page)).toEqual([]);
  await darkMode(page);
  expect(await blockingViolations(page)).toEqual([]);

  await page.getByRole("button", { name: "Unhappy", exact: true }).click();
  await expect(cards).toHaveCount(1);
});

test("Hide takes a review off the shop page, and Show brings it back", async ({ page }) => {
  const shopId = await openReviews(page);
  const unhappy = page.getByRole("listitem").filter({ hasText: "Atta was out of stock yesterday." });
  await unhappy.getByRole("button", { name: "Hide" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Review hidden from your shop page" })).toBeVisible();
  await expect(unhappy).toBeHidden();
  const isHidden = async () =>
    (await localAdmin().from("reviews").select("is_hidden").eq("shop_id", shopId).eq("sentiment", "NEGATIVE").single()).data?.is_hidden;
  await expect.poll(isHidden).toBe(true);

  await page.getByRole("button", { name: "Hidden", exact: true }).click();
  await expect(unhappy).toContainText("Hidden from your shop page");
  await unhappy.getByRole("button", { name: "Show" }).click();
  await expect.poll(isHidden).toBe(false);
});

test("the recording plays while it exists, then says it was removed", async ({ page }) => {
  const shopId = await openReviews(page);
  const db = localAdmin();
  const { data: review } = await db.from("reviews").select("id").eq("shop_id", shopId).eq("sentiment", "NEGATIVE").single();
  const path = `${shopId}/reviews/${review!.id}.wav`;
  await db.storage.from("voice").upload(path, tone(), { contentType: "audio/wav" });
  await db.from("reviews").update({ audio_path: path }).eq("id", review!.id);

  await page.reload();
  const card = page.getByRole("listitem").filter({ hasText: "Atta was out of stock yesterday." });
  await card.getByRole("button", { name: "Play recording" }).click();
  await expect(card.getByRole("button", { name: "Pause recording" })).toBeVisible();
  // The one-second clip ends by itself and the button resets.
  await expect(card.getByRole("button", { name: "Play recording" })).toBeVisible({ timeout: 10_000 });

  await db.from("reviews").update({ audio_deleted_at: new Date().toISOString() }).eq("id", review!.id);
  await page.reload();
  await expect(card).toContainText("Recording removed after 30 days");
  await expect(card.getByRole("button", { name: "Play recording" })).toBeHidden();
});

test("a shop with no reviews is pointed to its QR", async ({ page }) => {
  await signInAsNewOwner(page);
  await page.goto("/app/reviews");
  await expect(page.getByRole("heading", { name: "No reviews yet" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Get your QR" })).toHaveAttribute("href", "/app/shop");
});
