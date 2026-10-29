import { expect, test, type Page } from "@playwright/test";

import { blockingViolations, localAdmin, localSupabase, signInToDemo } from "./support";

// F-04 review gate: Check and confirm (O-4) and voice setup (O-3) against the
// local database. The Meta step is replaced with a proposal written straight
// to the database, so journeys never spend AI credit.

test.skip(!localSupabase, "needs the local Supabase stack");

async function demoShop(page: Page) {
  await signInToDemo(page);
  const { shop } = await page.evaluate(() => fetch("/api/v1/shops/me").then((r) => r.json() as Promise<{ shop: { id: string } }>));
  const { data: products } = await localAdmin().from("products").select("id, name, price_paise, is_in_stock").eq("shop_id", shop.id);
  const find = (prefix: string) => products!.find((p) => p.name.startsWith(prefix))!;
  return { shopId: shop.id, maggi: find("Maggi"), parle: find("Parle"), atta: find("Aashirvaad") };
}

async function proposalFor(shopId: string, changes: unknown[], transcript = "Maggi ka daam badhao, Parle-G teen bike, atta khatam") {
  const { data, error } = await localAdmin().from("proposals").insert({ shop_id: shopId, kind: "COMMAND", transcript, changes }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

test("edit, remove, confirm and undo a voice proposal", async ({ page }) => {
  const { shopId, maggi, parle, atta } = await demoShop(page);
  const id = await proposalFor(shopId, [
    { op: "update_price", product_id: maggi.id, price_paise: maggi.price_paise! + 100 },
    { op: "record_sale", product_id: parle.id, qty: 3 },
    { op: "add_product", name: "Tata Salt Lite", price_paise: null },
    { op: "set_in_stock", product_id: atta.id, in_stock: false },
  ]);
  await page.goto(`/app/check/${id}`);

  await expect(page.getByRole("heading", { level: 1, name: "Check and confirm" })).toBeVisible();
  await expect(page.getByText("What we heard")).toBeVisible();
  // Screens with their own bottom actions hide the tab bar.
  await expect(page.getByRole("navigation", { name: "Main sections" })).toBeHidden();
  // Doc 06: the unclear item is marked and not pre-selected.
  await expect(page.getByRole("checkbox", { name: /Add Tata Salt Lite/ })).toHaveAttribute("aria-checked", "false");
  await expect(page.getByText("Please check")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm 3 changes" })).toBeVisible();
  expect(await blockingViolations(page)).toEqual([]);

  await page.getByRole("button", { name: /Remove: Sold 3 × Parle-G/ }).click();
  await expect(page.getByRole("button", { name: "Confirm 2 changes" })).toBeVisible();

  await page.getByRole("button", { name: /Edit: Maggi/ }).click();
  const sheet = page.getByRole("dialog", { name: "Edit change" });
  await sheet.getByLabel("Price (₹)").fill("17");
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/Maggi.*→ ₹17/)).toBeVisible();

  await page.getByRole("button", { name: "Confirm 2 changes" }).click();
  await expect(page).toHaveURL("/app");
  const toast = page.getByRole("status").filter({ hasText: "2 changes saved" });
  await expect(toast).toBeVisible();

  const db = localAdmin();
  const saved = await db.from("products").select("price_paise").eq("id", maggi.id).single();
  expect(saved.data?.price_paise).toBe(1700);

  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Undone" })).toBeVisible();
  const [price, stock, proposal] = await Promise.all([
    db.from("products").select("price_paise").eq("id", maggi.id).single(),
    db.from("products").select("is_in_stock").eq("id", atta.id).single(),
    db.from("proposals").select("status").eq("id", id).single(),
  ]);
  expect(price.data?.price_paise).toBe(maggi.price_paise);
  expect(stock.data?.is_in_stock).toBe(atta.is_in_stock);
  expect(proposal.data?.status).toBe("UNDONE");
});

test("a proposal confirmed earlier shows as already handled", async ({ page }) => {
  const { shopId, maggi } = await demoShop(page);
  const id = await proposalFor(shopId, [{ op: "set_in_stock", product_id: maggi.id, in_stock: true }]);
  await localAdmin().from("proposals").update({ status: "CONFIRMED" }).eq("id", id);
  await page.goto(`/app/check/${id}`);
  await expect(page.getByRole("heading", { name: "Already handled" })).toBeVisible();
});

test("the tab-bar mic uploads the clip and opens Check and confirm", async ({ page }) => {
  const { shopId, maggi } = await demoShop(page);
  const id = await proposalFor(shopId, [{ op: "record_sale", product_id: maggi.id, qty: 2 }], "Maggi do packet bike");
  await page.route("**/api/v1/proposals/voice", async (route) => {
    const body = route.request().postDataJSON() as { path: string; kind: string };
    expect(body.kind).toBe("COMMAND");
    expect(body.path).toMatch(new RegExp(`^${shopId}/owner/[0-9a-f-]{36}\\.wav$`));
    await route.fulfill({ status: 201, json: { proposal: { id }, question: "Did you mean the 70 g pack?", rejected: [] } });
  });
  await page.evaluate(() => localStorage.setItem("sv_mic_primed", "1"));

  const nav = page.getByRole("navigation", { name: "Main sections" });
  await nav.getByRole("button", { name: "Tap to speak" }).click();
  await expect(nav.getByRole("button", { name: "Recording, tap to stop" })).toBeVisible();
  await page.waitForTimeout(1200);
  await nav.getByRole("button", { name: "Recording, tap to stop" }).click();

  await expect(page).toHaveURL(`/app/check/${id}`, { timeout: 15_000 });
  await expect(page.getByText("Sold 2 × Maggi")).toBeVisible();
  await expect(page.getByText("Did you mean the 70 g pack?")).toBeVisible();

  // The clip itself landed in the shop's private voice folder.
  const { data: files } = await localAdmin().storage.from("voice").list(`${shopId}/owner`);
  expect(files?.some((f) => f.name.endsWith(".wav"))).toBe(true);
});

for (const [status, code, words, retry] of [
  [422, "NOTHING_HEARD", "We didn't hear anything. Try again.", false],
  [503, "AI_UNAVAILABLE", "Couldn't understand that right now. Your recording is saved, so try again.", true],
  [503, "AI_PAUSED", "Voice is resting for now. You can still edit by tapping.", false],
] as const) {
  test(`explains ${code} from the voice step`, async ({ page }) => {
    await demoShop(page);
    let calls = 0;
    await page.route("**/api/v1/proposals/voice", (route) => {
      calls += 1;
      return route.fulfill({ status, json: { error: { code, message: "x" } } });
    });
    await page.evaluate(() => localStorage.setItem("sv_mic_primed", "1"));
    const nav = page.getByRole("navigation", { name: "Main sections" });
    await nav.getByRole("button", { name: "Tap to speak" }).click();
    await expect(nav.getByRole("button", { name: "Recording, tap to stop" })).toBeVisible();
    await page.waitForTimeout(1200);
    await nav.getByRole("button", { name: "Recording, tap to stop" }).click();
    const alert = nav.getByRole("alert");
    await expect(alert).toContainText(words, { timeout: 15_000 });
    if (retry) {
      // The recording is already stored, so Try again only re-asks the AI.
      await alert.getByRole("button", { name: "Try again" }).click();
      await expect.poll(() => calls).toBe(2);
    } else {
      await expect(alert.getByRole("button", { name: "Try again" })).toBeHidden();
    }
  });
}

test("voice setup screen is ready to record", async ({ page }) => {
  await demoShop(page);
  await page.goto("/app/setup");
  await expect(page.getByRole("heading", { level: 1, name: "Tell us about your shop" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tap to speak" })).toBeVisible();
  await expect(page.getByText("0:00 / 2:00")).toBeHidden();
  await expect(page.getByRole("link", { name: "Skip for now" })).toHaveAttribute("href", "/app");
  expect(await blockingViolations(page)).toEqual([]);
});
