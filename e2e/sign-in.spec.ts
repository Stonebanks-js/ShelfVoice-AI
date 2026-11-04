import { expect, test } from "@playwright/test";

import { blockingViolations, chooseLanguage, localAdmin, localSupabase, signInAsNewOwner, signInToSampleShop } from "./support";

// The first screen (shop owner or customer), the
// owner's Google sign-in and the four setup steps. The first block needs no
// backend. The second runs against the local Supabase stack when one is up
// (`supabase start`), and is skipped otherwise, as in the CI e2e job.

test.describe("first screen and sign-in", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("asks shop owner or customer, axe clean in both languages", async ({ page }) => {
    await page.goto("/");
    await chooseLanguage(page, "English");
    await expect(page.getByRole("heading", { level: 1, name: "Shelf Voice" })).toBeVisible();
    // A welcome first, then the two choices behind "Get started".
    await expect(page.getByText("Speak, and your shop is online")).toBeVisible();
    expect(await blockingViolations(page)).toEqual([]);
    await page.getByRole("link", { name: "Get started" }).click();
    await expect(page).toHaveURL("/?who=1");
    const choices = page.getByRole("navigation", { name: "Who are you?" });
    await expect(choices.getByRole("link", { name: /^Shop owner/ })).toHaveAttribute("href", "/owner");
    await expect(choices.getByRole("link", { name: /^Customer/ })).toHaveAttribute("href", "/shops");
    // No demo shop any more.
    await expect(page.getByText(/demo/i)).toHaveCount(0);
    expect(await blockingViolations(page)).toEqual([]);

    await chooseLanguage(page, "हिन्दी");
    await expect(page.getByRole("heading", { level: 1, name: "शेल्फ़ वॉइस" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^दुकानदार/ })).toBeVisible();
    expect(await blockingViolations(page)).toEqual([]);
  });

  test("shop owners continue with Google", async ({ page }) => {
    await page.goto("/?who=1");
    await chooseLanguage(page, "English");
    await page.getByRole("link", { name: /^Shop owner/ }).click();
    await expect(page).toHaveURL("/owner");
    await expect(page.getByRole("heading", { level: 1, name: "Your shop, online in minutes" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue with Google" })).toHaveAttribute("href", "/api/v1/auth/google");
    await expect(page.getByText("New here? Continuing with Google creates your account.")).toBeVisible();
    expect(await blockingViolations(page)).toEqual([]);
    await page.getByRole("link", { name: "Back" }).click();
    await expect(page).toHaveURL("/");
  });

  test("remembers the language choice", async ({ page }) => {
    await page.goto("/?who=1");
    await chooseLanguage(page, "हिन्दी");
    await page.reload();
    await expect(page.getByRole("link", { name: /^ग्राहक/ })).toBeVisible();
  });

  test("follows the phone's language on a first visit", async ({ browser }) => {
    const context = await browser.newContext({ locale: "hi-IN" });
    const page = await context.newPage();
    await page.goto("/?who=1");
    await expect(page.getByRole("link", { name: /^दुकानदार/ })).toBeVisible();
    await context.close();
  });

  test("says when Google sign-in didn't finish", async ({ page }) => {
    await page.goto("/owner?signin=failed");
    await chooseLanguage(page, "English");
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Sign-in didn't finish. Please try again.");
  });

  test("sends signed-out visitors from the owner app to the first screen", async ({ page }) => {
    await page.goto("/app/stock");
    await expect(page).toHaveURL("/");
  });

  test("the old demo sign-in is gone", async ({ request }) => {
    expect((await request.post("/api/v1/auth/demo")).status()).toBe(404);
  });
});

test.describe("signed-in entry", () => {
  test.skip(!localSupabase, "needs the local Supabase stack");

  test("a signed-in owner goes straight to the app", async ({ page }) => {
    await signInToSampleShop(page);
    await expect(page.getByRole("navigation", { name: "Main sections" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
    for (const path of ["/", "/owner"]) {
      await page.goto(path);
      await expect(page).toHaveURL("/app");
    }
  });

  test("a new owner answers four questions, then adds products", async ({ page, context }) => {
    const admin = localAdmin();
    const userId = await signInAsNewOwner(page, { withShop: false });
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 28.98418, longitude: 77.70642 });

    try {
      await page.goto("/app");
      await expect(page).toHaveURL("/app/welcome");
      await expect(page.getByRole("progressbar", { name: "Step 1 of 4" })).toBeVisible();
      await page.getByRole("radio", { name: "English" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Choose your language" })).toBeVisible();
      expect(await blockingViolations(page)).toEqual([]);
      await page.getByRole("button", { name: "Next" }).click();

      await expect(page.getByRole("heading", { level: 1, name: "What's your shop called?" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
      await page.getByRole("textbox", { name: "Shop name" }).fill("Gupta General Store");
      await page.getByRole("button", { name: "Next" }).click();

      await expect(page.getByRole("heading", { level: 1, name: "What kind of shop is it?" })).toBeVisible();
      await page.getByRole("radio", { name: "Departmental" }).click();
      expect(await blockingViolations(page)).toEqual([]);
      await page.getByRole("button", { name: "Next" }).click();

      await expect(page.getByRole("heading", { level: 1, name: "Where is your shop?" })).toBeVisible();
      await page.getByRole("button", { name: "Use my current location" }).click();
      await expect(page.getByRole("button", { name: "Location saved" })).toBeVisible();
      await page.getByRole("textbox", { name: "Address" }).fill("Shastri Nagar, Meerut");
      await page.getByRole("textbox", { name: "Pincode" }).fill("25000");
      await page.getByRole("button", { name: "Create my shop" }).click();
      await expect(page.getByText("A pincode has 6 digits.").first()).toBeVisible();
      await page.getByRole("textbox", { name: "Pincode" }).fill("250004");
      expect(await blockingViolations(page)).toEqual([]);
      await page.getByRole("button", { name: "Create my shop" }).click();

      await expect(page).toHaveURL("/app/setup");
      await expect(page.getByRole("heading", { level: 1, name: "Add your products" })).toBeVisible();
      const { data: shop } = await admin.from("shops").select("name, language, category, address, pincode, lat, lng, is_published").eq("owner_id", userId).single();
      expect(shop).toEqual({
        name: "Gupta General Store",
        language: "en",
        category: "Departmental store",
        address: "Shastri Nagar, Meerut",
        pincode: "250004",
        lat: 28.98418,
        lng: 77.70642,
        is_published: false,
      });

      // The ready-made list opens on the type the owner picked.
      await page.getByRole("link", { name: /^Ready-made list/ }).click();
      await expect(page.getByRole("button", { name: "Departmental", pressed: true })).toBeVisible();
    } finally {
      await admin.from("shops").delete().eq("owner_id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
  });

  test("a hidden shop with products is shown to customers from Home", async ({ page }) => {
    const userId = await signInAsNewOwner(page);
    const admin = localAdmin();
    const { data: shop } = await admin.from("shops").select("id").eq("owner_id", userId).single();
    await admin.from("products").insert({ shop_id: shop!.id, name: "Tata Salt", price_paise: 2800 });
    await page.goto("/app");
    await expect(page.getByText("Your shop is hidden from customers")).toBeVisible();
    await page.getByRole("button", { name: "Show my shop to customers" }).click();
    await expect(page.getByText(/^Customers can see your shop/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Show my shop to customers" })).toBeHidden();
    await expect.poll(async () => (await admin.from("shops").select("is_published").eq("id", shop!.id).single()).data?.is_published).toBe(true);
  });
});
