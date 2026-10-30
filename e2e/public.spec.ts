import { expect, test, type Page } from "@playwright/test";

import { blockingViolations, darkMode, localAdmin, localSupabase, ownTestAddress, signInToDemo } from "./support";

// F-11 review gate: the public storefront (P-1) and the voice review page
// (P-2), seen as a customer with no account. Turnstile's browser script is
// replaced with a stand-in that returns Cloudflare's dummy token; the server
// still verifies it with Cloudflare's test secret.

test.skip(!localSupabase, "needs the local Supabase stack");

// A demo shop made by an owner, then the owner's cookies dropped.
async function demoAsCustomer(page: Page) {
  await signInToDemo(page);
  const { shop } = await page.evaluate(() => fetch("/api/v1/shops/me").then((r) => r.json() as Promise<{ shop: { id: string; slug: string } }>));
  return shop;
}

async function fakeTurnstile(page: Page) {
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.turnstile = {
        render(el, opts) { window.__ts = opts; return "w1"; },
        execute() { setTimeout(() => window.__ts.callback("XXXX.DUMMY.TOKEN.XXXX"), 10); },
        reset() {}, remove() {}
      };`,
    }),
  );
}

test.describe("storefront", () => {
  test("shows the shop, its products and the ways to reach it", async ({ page, context }) => {
    const shop = await demoAsCustomer(page);
    await context.clearCookies();
    await page.goto(`/s/${shop.slug}`);

    await expect(page.getByRole("heading", { level: 1, name: "Sharma Kirana Store" })).toBeVisible();
    await expect(page.getByText(/Open now, closes|Closed, opens/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+919876543210");
    const products = page.getByRole("region", { name: "Products" });
    await expect(products.getByText("Maggi 2-Minute Noodles")).toBeVisible();
    // Never a stock count, only in or out (errata E-05).
    await expect(products).not.toContainText("18");
    expect(await blockingViolations(page)).toEqual([]);
    await darkMode(page);
    expect(await blockingViolations(page)).toEqual([]);

    // Ticked items go into the WhatsApp message.
    await page.getByRole("checkbox", { name: /Maggi/ }).click();
    await page.getByRole("checkbox", { name: /Parle-G/ }).click();
    const whatsapp = page.getByRole("link", { name: "Ask about 2 items on WhatsApp" });
    const href = decodeURIComponent((await whatsapp.getAttribute("href"))!);
    expect(href.startsWith("https://wa.me/919876543210?text=")).toBe(true);
    expect(href).toContain("Hello Sharma Kirana Store, is this available?");
    expect(href).toContain("• Maggi 2-Minute Noodles (70 g)");

    await page.getByRole("button", { name: "Dairy", exact: true }).click();
    await expect(products.getByText("Amul Butter")).toBeVisible();
    await expect(products.getByText("Maggi 2-Minute Noodles")).toBeHidden();
    await expect(page.getByRole("link", { name: /Leave a voice review/ })).toHaveAttribute("href", `/r/${shop.slug}`);
  });

  test("owner changes show up at once: out of stock, then unpublished", async ({ page, browser }) => {
    const shop = await demoAsCustomer(page);
    const { data: maggi } = await localAdmin().from("products").select("id").eq("shop_id", shop.id).like("name", "Maggi%").single();
    const customer = await (await browser.newContext()).newPage();
    await customer.goto(`/s/${shop.slug}`);
    await expect(customer.getByRole("checkbox", { name: /Maggi/ })).toBeVisible();

    // The owner's edits revalidate the cached storefront.
    await page.evaluate((id) => fetch(`/api/v1/products/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ is_in_stock: false }) }), maggi!.id);
    await customer.reload();
    const row = customer.getByRole("listitem").filter({ hasText: "Maggi 2-Minute Noodles" });
    await expect(row).toContainText("Out of stock");
    await expect(row.getByRole("checkbox")).toHaveCount(0);

    await page.evaluate((id) => fetch(`/api/v1/shops/${id}/publish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ published: false }) }), shop.id);
    await customer.reload();
    await expect(customer.getByRole("heading", { name: "This shop isn't online right now" })).toBeVisible();
    await customer.goto(`/r/${shop.slug}`);
    await expect(customer.getByRole("heading", { name: "This shop isn't online right now" })).toBeVisible();
  });

  test("an unknown shop shows the not-found page, kept out of search", async ({ page }) => {
    await page.goto("/s/no-such-shop-here");
    await expect(page.getByRole("heading", { name: "This shop isn't online right now" })).toBeVisible();
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(1);
  });
});

test.describe("voice review", () => {
  test("consent, 15-second recording, thank you", async ({ page, context }) => {
    const shop = await demoAsCustomer(page);
    await context.clearCookies();
    await ownTestAddress(page);
    await fakeTurnstile(page);
    await page.goto(`/r/${shop.slug}`);

    await expect(page.getByRole("heading", { level: 1, name: "Tell Sharma Kirana Store how they did, in 15 seconds." })).toBeVisible();
    await expect(page.getByText("Please do not say your name or phone number. For adults 18 and over.")).toBeVisible();
    expect(await blockingViolations(page)).toEqual([]);

    await page.getByRole("button", { name: "I agree, record" }).click();
    const stop = page.getByRole("button", { name: "Recording, tap to stop" });
    await expect(stop).toBeVisible();
    await expect(page.getByText(/^0:\d\d \/ 0:15$/)).toBeVisible();
    await page.waitForTimeout(1500);
    await stop.click();
    await expect(page.getByRole("status").filter({ hasText: "Thank you! The shop will hear this." })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: "Back to Sharma Kirana Store" })).toHaveAttribute("href", `/s/${shop.slug}`);

    const { data: reviews } = await localAdmin().from("reviews").select("audio_path, consent_at").eq("shop_id", shop.id).not("audio_path", "is", null);
    expect(reviews).toHaveLength(1);
    expect(reviews![0].consent_at).not.toBeNull();
  });

  test("a failed send offers Try again with the same recording", async ({ page, context }) => {
    const shop = await demoAsCustomer(page);
    await context.clearCookies();
    await ownTestAddress(page);
    await fakeTurnstile(page);
    let calls = 0;
    await page.route(`**/api/v1/public/shops/${shop.slug}/reviews`, async (route) => {
      calls += 1;
      if (calls === 1) return route.fulfill({ status: 503, json: { error: { code: "AI_UNAVAILABLE", message: "x" } } });
      return route.continue();
    });
    await page.goto(`/r/${shop.slug}`);
    await page.getByRole("button", { name: "I agree, record" }).click();
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Recording, tap to stop" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Couldn't send. Tap to try again.");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Thank you!" })).toBeVisible({ timeout: 20_000 });
    expect(calls).toBe(2);
  });

  test("too many reviews asks the customer to come back tomorrow", async ({ page, context }) => {
    const shop = await demoAsCustomer(page);
    await context.clearCookies();
    await fakeTurnstile(page);
    await page.route(`**/api/v1/public/shops/${shop.slug}/reviews`, (route) =>
      route.fulfill({ status: 429, json: { error: { code: "RATE_LIMITED", message: "x" } } }),
    );
    await page.goto(`/r/${shop.slug}`);
    await page.getByRole("button", { name: "I agree, record" }).click();
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Recording, tap to stop" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Too many reviews from this phone today. Please try again tomorrow.");
  });
});
