import { expect, test, type Browser, type Page } from "@playwright/test";

import { blockingViolations, darkMode, localAdmin, localSupabase, ownTestAddress, signInAsNewOwner, signInToSampleShop } from "./support";

// A customer fills a cart on the shop page (ADD, then − n +),
// orders for pickup or delivery with a name and number, and follows the
// order; the owner accepts it, marks what's missing, says it's ready and
// finishes it, which logs the sales.

test.skip(!localSupabase, "needs the local Supabase stack");

// Turnstile's test widget: passes at once (the server's test secret accepts it).
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

// The owner's sample shop, and a separate phone for the customer.
async function ownerAndCustomer(page: Page, browser: Browser) {
  await signInToSampleShop(page);
  const { shop } = await page.evaluate(() => fetch("/api/v1/shops/me").then((r) => r.json() as Promise<{ shop: { id: string; slug: string } }>));
  const customerContext = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
  const customer = await customerContext.newPage();
  await ownTestAddress(customer);
  await fakeTurnstile(customer);
  return { shop, customer, close: () => customerContext.close() };
}

test("a customer orders for pickup, and the owner takes it from new to done", async ({ page, browser }) => {
  const { shop, customer, close } = await ownerAndCustomer(page, browser);
  try {
    const { data: before } = await localAdmin().from("products").select("id, stock_qty").eq("shop_id", shop.id).like("name", "Maggi%").single();

    await customer.goto(`/s/${shop.slug}`);
    await customer.getByRole("button", { name: /^Add Maggi/ }).click();
    await customer.getByRole("button", { name: /^One more Maggi/ }).click();
    await customer.getByRole("button", { name: /^Add Parle-G/ }).click();
    const bar = customer.getByRole("button", { name: /View cart/ });
    await expect(bar).toContainText("3 items");
    expect(await blockingViolations(customer)).toEqual([]);

    // The cart survives a reload on the same phone.
    await customer.reload();
    await expect(bar).toContainText("3 items");
    await bar.click();
    const sheet = customer.getByRole("dialog", { name: "Your order" });
    await expect(sheet.getByText("This shop doesn't deliver yet, so pick your order up.")).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Place order" })).toBeDisabled();
    await sheet.getByRole("textbox", { name: "Your name" }).fill("Ramesh");
    await sheet.getByRole("textbox", { name: "Mobile number" }).fill("98765 43210");
    expect(await blockingViolations(customer)).toEqual([]);
    await sheet.getByRole("button", { name: /^Place order/ }).click();

    await expect(customer).toHaveURL(/\/o\/[0-9a-f-]{36}\?t=/, { timeout: 15_000 });
    await expect(customer.getByRole("status")).toContainText("Sent to the shop");
    await expect(customer.getByRole("list", { name: "Your order" })).toContainText("Maggi 2-Minute Noodles × 2");
    const code = (await customer.getByRole("heading", { level: 1 }).textContent())!.replace("Order ", "");
    expect(await blockingViolations(customer)).toEqual([]);

    // The owner sees it on Home, then works it in Orders.
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: /Customer orders · 1 new/ })).toBeVisible();
    await page.getByRole("navigation", { name: "Main sections" }).getByRole("link", { name: "Orders" }).click();
    const card = page.getByRole("listitem").filter({ hasText: code });
    await expect(card).toContainText("Ramesh");
    await expect(card).toContainText("Pickup at the shop");
    expect(await blockingViolations(page)).toEqual([]);
    await card.getByRole("button", { name: "Don't have Parle-G Biscuit" }).click();
    await card.getByRole("button", { name: "Accept" }).click();
    await expect(card.getByRole("button", { name: "Ready" })).toBeVisible();
    await expect(card).toContainText("Accepted");
    await expect(card.getByRole("link", { name: "Message" })).toHaveAttribute("href", /wa\.me\/919876543210\?text=.*being%20packed/);
    await card.getByRole("button", { name: "Ready" }).click();
    await expect(card.getByRole("button", { name: "Done, items given" })).toBeVisible();

    await customer.reload();
    await expect(customer.getByRole("status")).toContainText("Ready to pick up");
    await expect(customer.getByRole("listitem").filter({ hasText: "Parle-G" })).toContainText("Not available");

    await card.getByRole("button", { name: "Done, items given" }).click();
    await expect(page.getByRole("heading", { name: /Done today/ })).toBeVisible();
    await darkMode(page);
    expect(await blockingViolations(page)).toEqual([]);

    // Only what was given is sold, once.
    const { data: after } = await localAdmin().from("products").select("stock_qty").eq("id", before!.id).single();
    expect(after!.stock_qty).toBe(before!.stock_qty! - 2);
    const { data: sales } = await localAdmin().from("stock_movements").select("qty, source").eq("shop_id", shop.id).eq("source", "ORDER");
    expect(sales).toEqual([{ qty: 2, source: "ORDER" }]);
    await customer.reload();
    await expect(customer.getByRole("status")).toContainText("Done. Thank you!");
  } finally {
    await close();
  }
});

test("home delivery appears once the shop delivers, and needs an address", async ({ page, browser }) => {
  const { shop, customer, close } = await ownerAndCustomer(page, browser);
  try {
    await page.goto("/app/shop");
    await page.getByRole("switch", { name: "We deliver to homes" }).click();
    await expect.poll(async () => (await localAdmin().from("shops").select("delivers").eq("id", shop.id).single()).data?.delivers).toBe(true);

    await customer.goto(`/s/${shop.slug}`);
    await customer.getByRole("button", { name: /^Add Tata Salt/ }).click();
    await customer.getByRole("button", { name: /View cart/ }).click();
    const sheet = customer.getByRole("dialog", { name: "Your order" });
    await sheet.getByRole("radio", { name: "Home delivery" }).click();
    await sheet.getByRole("textbox", { name: "Your name" }).fill("Sunita");
    await sheet.getByRole("textbox", { name: "Mobile number" }).fill("9876500011");
    await expect(sheet.getByRole("button", { name: /^Place order/ })).toBeDisabled();
    await sheet.getByRole("textbox", { name: "Delivery address" }).fill("House 4, Gali 2, Shastri Nagar");
    await sheet.getByRole("button", { name: /^Place order/ }).click();
    await expect(customer).toHaveURL(/\/o\//, { timeout: 15_000 });
    await expect(customer.getByRole("status")).toContainText("Sent to the shop");

    await page.goto("/app/orders");
    await expect(page.getByRole("listitem").filter({ hasText: "Sunita" })).toContainText("Deliver to: House 4, Gali 2, Shastri Nagar");
  } finally {
    await close();
  }
});

test("a bad order link shows a plain message", async ({ page }) => {
  await page.goto("/o/00000000-0000-4000-8000-000000000000?t=nottherighttokenatall");
  await expect(page.getByRole("heading", { name: "This order link doesn't work. Please check it, or call the shop." })).toBeVisible();
});

test("+ on an uncounted stock row starts counting it", async ({ page }) => {
  const userId = await signInAsNewOwner(page);
  const admin = localAdmin();
  const { data: shop } = await admin.from("shops").select("id").eq("owner_id", userId).single();
  const { data: product } = await admin.from("products").insert({ shop_id: shop!.id, name: "Jaggery", stock_qty: null }).select("id").single();
  await page.goto("/app/stock");
  const row = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: /^Jaggery/ }) });
  await expect(row.getByRole("status")).toHaveText("Not counted");
  await row.getByRole("button", { name: "One more Jaggery" }).click();
  await row.getByRole("button", { name: "One more Jaggery" }).click();
  await expect.poll(async () => (await admin.from("products").select("stock_qty").eq("id", product!.id).single()).data?.stock_qty).toBe(2);
  await page.reload();
  await expect(page.getByRole("listitem").filter({ has: page.getByRole("button", { name: /^Jaggery/ }) }).getByRole("status")).toHaveText("2");
});

// TEMPORARY for the demo recording (lib/live-orders): when the order
// can't reach the shop, the customer still sees it placed, with a 15-minute
// live tracker, and it shows under "Your current orders"; a mistake they can
// fix still shows its reason.
test("an order that can't reach the shop still shows as placed, with live delivery", async ({ page, browser }) => {
  const { shop, customer, close } = await ownerAndCustomer(page, browser);
  try {
    await customer.goto(`/s/${shop.slug}`);
    await customer.getByRole("button", { name: /^Add Maggi/ }).click();
    await customer.getByRole("button", { name: /View cart/ }).click();
    const sheet = customer.getByRole("dialog", { name: "Your order" });
    await sheet.getByRole("textbox", { name: "Your name" }).fill("Ramesh");
    await sheet.getByRole("textbox", { name: "Mobile number" }).fill("98765 43210");

    await customer.route(`**/api/v1/public/shops/${shop.slug}/orders`, (route) =>
      route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: { code: "TURNSTILE_FAILED", message: "Bot check failed" } }) }),
    );
    await sheet.getByRole("button", { name: /^Place order/ }).click();
    await expect(customer).toHaveURL(/\/orders\/live\?ref=demo-/);
    await expect(customer.getByRole("heading", { level: 1, name: "Order placed" })).toBeVisible();
    await expect(customer.getByRole("status")).toHaveText(/Ready in (9|10) min/); // pickup: ready at the shop
    await expect(customer.getByText("Maggi 2-Minute Noodles × 1")).toBeVisible();
    expect(await blockingViolations(customer)).toEqual([]);
    await darkMode(customer);
    expect(await blockingViolations(customer)).toEqual([]);

    await customer.goto("/shops");
    const current = customer.getByRole("region", { name: "Your current orders" });
    await expect(current).toContainText("Sharma Kirana Store");
    await current.getByRole("link").first().click();
    await expect(customer.getByRole("heading", { level: 1, name: "Order placed" })).toBeVisible();

    // A mistake the customer can fix still says what it is.
    await customer.goto(`/s/${shop.slug}`);
    await customer.getByRole("button", { name: /^Add Parle-G/ }).click();
    await customer.getByRole("button", { name: /View cart/ }).click();
    await customer.route(`**/api/v1/public/shops/${shop.slug}/orders`, (route) =>
      route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ error: { code: "BAD_PHONE", message: "Check the phone" } }) }),
    );
    await sheet.getByRole("textbox", { name: "Your name" }).fill("Ramesh");
    await sheet.getByRole("textbox", { name: "Mobile number" }).fill("98765 43210");
    await sheet.getByRole("button", { name: /^Place order/ }).click();
    await expect(sheet.getByRole("alert")).toHaveText("Please check the mobile number.");
  } finally {
    await close();
  }
});
