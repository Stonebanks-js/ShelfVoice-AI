import { expect, test, type Page } from "@playwright/test";

import { blockingViolations, localAdmin, localSupabase, signInAsNewOwner, signInToDemo } from "./support";

// F-07 review gate: the order list (O-7) against the local database. AI
// wording runs in recorded mode here, so every reason is the template
// sentence, which quotes the same numbers.

test.skip(!localSupabase, "needs the local Supabase stack");

async function openOrders(page: Page) {
  await signInToDemo(page);
  const { shop } = await page.evaluate(() => fetch("/api/v1/shops/me").then((r) => r.json() as Promise<{ shop: { id: string } }>));
  await page.getByRole("navigation", { name: "Main sections" }).getByRole("link", { name: "Orders" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
  return shop.id;
}

test("the customer-flagged atta leads, with a quantity and a reason", async ({ page }) => {
  await openOrders(page);
  const first = page.getByRole("listitem").first();
  await expect(first.getByRole("heading", { level: 2 })).toContainText("Aashirvaad Atta");
  await expect(first).toContainText("Customers asked");
  const qty = (await first.locator("p.font-display").textContent())!.trim();
  expect(Number(qty)).toBeGreaterThan(0);
  await expect(first).toContainText(`Order ${qty}.`);
  expect(await blockingViolations(page)).toEqual([]);
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await blockingViolations(page)).toEqual([]);
});

test("Share sends the list as a message", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { shared: string[] }).shared = [];
    navigator.share = async (data?: ShareData) => {
      (window as unknown as { shared: string[] }).shared.push(data?.text ?? "");
    };
  });
  await openOrders(page);
  await page.getByRole("button", { name: "Share" }).click();
  const text = await page.evaluate(() => (window as unknown as { shared: string[] }).shared[0]);
  expect(text).toContain("Order for Sharma Kirana Store");
  expect(text).toMatch(/• Aashirvaad Atta \(5 kg\) × \d+/);
});

test("Delivery arrived adds stock and takes the item off the list", async ({ page }) => {
  const shopId = await openOrders(page);
  const atta = page.getByRole("listitem").filter({ hasText: "Aashirvaad Atta" });
  await atta.getByRole("button", { name: "Delivery arrived" }).click();
  const sheet = page.getByRole("dialog", { name: "Delivery arrived" });
  const qty = Number(await sheet.getByLabel("How many Aashirvaad Atta came?").inputValue());
  expect(qty).toBeGreaterThan(0);
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status").filter({ hasText: `Aashirvaad Atta: ${qty} added to stock` })).toBeVisible();

  const { data } = await localAdmin().from("products").select("id, stock_qty").eq("shop_id", shopId).like("name", "Aashirvaad%").single();
  expect(data!.stock_qty).toBe(3 + qty);
  const { data: moves } = await localAdmin().from("stock_movements").select("kind, qty").eq("product_id", data!.id).eq("source", "TAP");
  expect(moves).toEqual([{ kind: "DELIVERY", qty }]);
  // The forecast refreshes after the delivery; the list follows on reload.
  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("heading", { level: 2, name: /Aashirvaad Atta/ })).toBeHidden();
  }).toPass({ timeout: 15_000 });
});

test("a new shop has nothing to order, then warns at its own level", async ({ page }) => {
  await signInAsNewOwner(page);
  await page.goto("/app/orders");
  await expect(page.getByRole("heading", { name: "Nothing to order right now" })).toBeVisible();

  // Added by tap with 1 left and a warning level of 2: cold start, no
  // quantity yet, and the two-week note.
  const added = await page.evaluate(() =>
    fetch("/api/v1/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Rin Bar", price_paise: 1000, stock_qty: 1, low_stock_level: 2 }),
    }).then((r) => r.status),
  );
  expect(added).toBe(201);
  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("heading", { level: 2, name: "Rin Bar" })).toBeVisible();
  }).toPass({ timeout: 15_000 });
  await expect(page.getByText("Smart order list starts after 2 weeks of sales.")).toBeVisible();
  await expect(page.getByText("Only 1 left, at or below your warning level of 2.")).toBeVisible();
});
