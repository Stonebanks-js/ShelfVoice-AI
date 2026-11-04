import { expect, test, type Browser, type Page } from "@playwright/test";

import { blockingViolations, darkMode, localAdmin, localSupabase, ownTestAddress, signInAsNewOwner, signInToSampleShop } from "./support";

// Customer accounts (details, saved addresses, wishlist,
// favourite shops, past orders, Order again, refunds) and the owner's
// settings (UPI ID, delivery charge, refunds, QR poster, help).

test.skip(!localSupabase, "needs the local Supabase stack");

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

// A signed-in customer on their own phone.
async function customerPhone(browser: Browser, page: Page) {
  const context = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
  const customer = await context.newPage();
  await ownTestAddress(customer);
  await fakeTurnstile(customer);
  await signInAsNewOwner(customer, { withShop: false });
  return { customer, close: () => context.close() };
}

test("signed out, Account offers Google sign-in that comes back to the shop", async ({ page }) => {
  await page.goto("/me?next=/s/some-shop");
  await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue with Google" })).toHaveAttribute("href", "/api/v1/auth/google?next=%2Fs%2Fsome-shop");
  expect(await blockingViolations(page)).toEqual([]);
});

test("a customer saves details and an address, then sees them filled in at checkout", async ({ page, context }) => {
  const userId = await signInAsNewOwner(page, { withShop: false });
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 28.99, longitude: 77.7 });
  await page.goto("/me");
  await page.getByRole("button", { name: /^Not set/ }).click();
  const profile = page.getByRole("dialog", { name: "Your details" });
  await profile.getByRole("textbox", { name: "Your name" }).fill("Sunita");
  await profile.getByRole("textbox", { name: "Mobile number" }).fill("98765 00011");
  await profile.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: /^Sunita/ })).toContainText("+91 98765 00011");

  await page.getByRole("button", { name: "Add an address" }).click();
  const sheet = page.getByRole("dialog", { name: "Add an address" });
  await sheet.getByRole("textbox", { name: "Address" }).fill("House 4, Gali 2, Shastri Nagar");
  await sheet.getByRole("button", { name: "Use my current location" }).click();
  await expect(sheet.getByRole("button", { name: "Location saved" })).toBeVisible();
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Home/ })).toContainText("Default");
  await page.getByRole("radio", { name: "UPI" }).click();
  expect(await blockingViolations(page)).toEqual([]);
  await darkMode(page);
  expect(await blockingViolations(page)).toEqual([]);

  const { data } = await localAdmin().from("customer_addresses").select("lat, lng, is_default").eq("user_id", userId);
  expect(data).toEqual([{ lat: 28.99, lng: 77.7, is_default: true }]);
  await expect.poll(async () => (await localAdmin().from("customers").select("pay_with").eq("user_id", userId).maybeSingle()).data?.pay_with).toBe("UPI");
});

test("owner settings, then a signed-in customer's order: delivery charge, UPI, refund, Order again", async ({ page, browser }) => {
  test.slow(); // two people, a whole order and a refund: the longest journey
  await signInToSampleShop(page);
  const { shop } = await page.evaluate(() => fetch("/api/v1/shops/me").then((r) => r.json() as Promise<{ shop: { id: string; slug: string } }>));

  // The owner: UPI ID and delivery with a ₹20 charge.
  await page.goto("/app/shop");
  await page.getByRole("button", { name: /^UPI ID/ }).click();
  const upi = page.getByRole("dialog", { name: "UPI ID" });
  await upi.getByRole("textbox", { name: "UPI ID" }).fill("sharma store");
  await upi.getByRole("button", { name: "Save" }).click();
  await expect(upi.getByText("That doesn't look like a UPI ID. It looks like name@bank.")).toBeVisible();
  await upi.getByRole("textbox", { name: "UPI ID" }).fill("sharmastore@okaxis");
  await upi.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: /^UPI ID/ })).toContainText("sharmastore@okaxis");
  await page.getByRole("switch", { name: "We deliver to homes" }).click();
  await page.getByRole("button", { name: /^Delivery settings/ }).click();
  const delivery = page.getByRole("dialog", { name: "Delivery settings" });
  await delivery.getByRole("textbox", { name: "Delivery charge" }).fill("20");
  await delivery.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: /^Delivery settings/ })).toContainText("Delivery ₹20");
  await expect(page.getByText(/^Signed in as /)).toBeVisible();
  expect(await blockingViolations(page)).toEqual([]);

  const { customer, close } = await customerPhone(browser, page);
  try {
    await customer.goto("/me");
    await customer.getByRole("button", { name: "Add an address" }).click();
    await customer.getByRole("dialog", { name: "Add an address" }).getByRole("textbox", { name: "Address" }).fill("12 Main Road");
    await customer.getByRole("dialog", { name: "Add an address" }).getByRole("button", { name: "Save", exact: true }).click();
    await expect(customer.getByRole("button", { name: /^Home/ })).toBeVisible();

    // Hearts, then the cart.
    await customer.goto(`/s/${shop.slug}`);
    await expect(customer.getByText("Takes Cash · UPI · Pay on delivery")).toBeVisible();
    await customer.getByRole("button", { name: "Save this shop" }).click();
    await customer.getByRole("button", { name: /^Save Amul Butter/ }).click();
    await expect(customer.getByRole("button", { name: /^Save Amul Butter/ })).toHaveAttribute("aria-pressed", "true");
    await customer.getByRole("button", { name: /^Add Tata Salt/ }).click();
    await customer.getByRole("button", { name: /View cart/ }).click();
    const sheet = customer.getByRole("dialog", { name: "Your order" });
    await sheet.getByRole("radio", { name: "Home delivery" }).click();
    await expect(sheet.getByRole("radio", { name: /^Home\s*12 Main Road/ })).toHaveAttribute("aria-checked", "true");
    await expect(sheet.getByText("₹20", { exact: true })).toBeVisible();
    await sheet.getByRole("textbox", { name: "Your name" }).fill("Ramesh");
    await sheet.getByRole("textbox", { name: "Mobile number" }).fill("9876500022");
    expect(await blockingViolations(customer)).toEqual([]);
    await sheet.getByRole("button", { name: /^Place order · ₹48/ }).click();
    await expect(customer).toHaveURL(/\/o\//, { timeout: 15_000 });
    const code = (await customer.getByRole("heading", { level: 1 }).textContent())!.replace("Order ", "");

    // The owner accepts: the customer can pay by UPI, with the charge in.
    await page.goto("/app/orders");
    const card = page.getByRole("listitem").filter({ hasText: code });
    await expect(card).toContainText("Deliver to: 12 Main Road");
    await card.getByRole("button", { name: "Accept" }).click();
    await expect(card.getByRole("button", { name: "Ready" })).toBeVisible();
    await customer.reload();
    await expect(customer.getByRole("link", { name: "Pay ₹48 by UPI" })).toHaveAttribute("href", /^upi:\/\/pay\?pa=sharmastore%40okaxis&.*am=48\.00/);
    await expect(customer.getByRole("img", { name: "Pay ₹48 by UPI" })).toBeVisible();

    // Done, then a ₹10 refund the customer sees.
    await card.getByRole("button", { name: "Ready" }).click();
    await card.getByRole("button", { name: "Done, items given" }).click();
    await page.getByRole("listitem").filter({ hasText: code }).getByRole("button", { name: "Refund" }).click();
    const refund = page.getByRole("dialog", { name: `Refund on order ${code}` });
    await refund.getByRole("textbox", { name: "Amount (₹)" }).fill("10");
    await refund.getByRole("textbox", { name: "Why" }).fill("Salt packet torn");
    await refund.getByRole("button", { name: "Refund" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: code })).toContainText("Refunded ₹10: Salt packet torn");

    await customer.goto("/me");
    await expect(customer.getByRole("region", { name: "My refunds" })).toContainText("₹10");
    await expect(customer.getByRole("region", { name: "My wishlist" })).toContainText("Amul Butter");
    await expect(customer.getByRole("region", { name: "Favourite shops" })).toContainText("Sharma Kirana Store");
    expect(await blockingViolations(customer)).toEqual([]);
    await customer.getByRole("button", { name: "Order again" }).click();
    await expect(customer).toHaveURL(`/s/${shop.slug}`);
    await expect(customer.getByRole("button", { name: /View cart/ })).toContainText("1 item");
  } finally {
    await close();
  }
});

test("the owner finds help, the shop-page QR and the customer view", async ({ page }) => {
  await signInToSampleShop(page);
  await page.getByRole("link", { name: "Account and settings" }).click();
  await expect(page).toHaveURL("/app/shop");
  await page.getByRole("button", { name: "QR poster for your shop page" }).click();
  await expect(page.getByRole("dialog", { name: "Order from us on your phone" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Help" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Help" })).toBeVisible();
  await page.getByText("How do I get paid?").click();
  await expect(page.getByText(/Customers pay you directly/)).toBeVisible();
  expect(await blockingViolations(page)).toEqual([]);
  await page.goto("/app/shop");
  await page.getByRole("link", { name: "Shop as a customer" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
});
