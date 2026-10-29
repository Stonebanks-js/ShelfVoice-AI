import { execSync } from "node:child_process";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// F-02 review gate: O-1 sign-in and O-2 language choice. The first block
// needs no backend (API failures are simulated). The second runs against the
// local Supabase stack when one is up (`supabase start`), and is skipped
// otherwise, as in the CI e2e job.

async function blockingViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id);
}

test.describe("sign-in screen", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("offers Google and the demo shop, axe clean in both languages", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("radio", { name: "English" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Shelf Voice" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue with Google" })).toHaveAttribute("href", "/api/v1/auth/google");
    await expect(page.getByRole("button", { name: "Try the demo shop" })).toBeVisible();
    expect(await blockingViolations(page)).toEqual([]);

    await page.getByRole("radio", { name: "हिन्दी" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "शेल्फ़ वॉइस" })).toBeVisible();
    await expect(page.locator('[lang="hi"]').first()).toBeVisible();
    expect(await blockingViolations(page)).toEqual([]);
  });

  test("remembers the language choice", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("radio", { name: "हिन्दी" }).click();
    await page.reload();
    await expect(page.getByRole("button", { name: "डेमो दुकान देखें" })).toBeVisible();
  });

  test("follows the phone's language on a first visit", async ({ browser }) => {
    const context = await browser.newContext({ locale: "hi-IN" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("button", { name: "डेमो दुकान देखें" })).toBeVisible();
    await context.close();
  });

  for (const [status, code, words] of [
    [429, "RATE_LIMITED", "Too many tries. Please wait a little and try again."],
    [503, "DEMO_UNAVAILABLE", "The demo shop isn't available right now. Please try again soon."],
    [500, "INTERNAL", "Something went wrong. Please try again."],
  ] as const) {
    test(`explains a ${status} from the demo sign-in`, async ({ page }) => {
      await page.route("**/api/v1/auth/demo", (route) =>
        route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: { code, message: "x" } }) }),
      );
      await page.goto("/");
      await page.getByRole("radio", { name: "English" }).click();
      await page.getByRole("button", { name: "Try the demo shop" }).click();
      await expect(page.getByRole("main").getByRole("alert")).toHaveText(words);
      await expect(page.getByRole("button", { name: "Try the demo shop" })).toBeEnabled();
    });
  }

  test("explains being offline", async ({ page }) => {
    await page.route("**/api/v1/auth/demo", (route) => route.abort("internetdisconnected"));
    await page.goto("/");
    await page.getByRole("radio", { name: "English" }).click();
    await page.getByRole("button", { name: "Try the demo shop" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("You're offline. Check your internet and try again.");
  });

  test("says when Google sign-in didn't finish", async ({ page }) => {
    await page.goto("/?signin=failed");
    await page.getByRole("radio", { name: "English" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Sign-in didn't finish. Please try again.");
  });

  test("sends signed-out visitors from the owner app to sign in", async ({ page }) => {
    await page.goto("/app/stock");
    await expect(page).toHaveURL("/");
  });
});

// ------------------------------------------------------------ with Supabase
function localSupabase() {
  try {
    const out = execSync("pnpm exec supabase status -o json", { stdio: ["ignore", "pipe", "ignore"], timeout: 60_000 }).toString();
    const status = JSON.parse(out.slice(out.indexOf("{"))) as Record<string, string>;
    return status.API_URL?.includes("127.0.0.1") ? status : null;
  } catch {
    return null;
  }
}
const supabase = process.env.CI ? null : localSupabase();

test.describe("signed-in entry", () => {
  test.skip(!supabase, "needs the local Supabase stack");

  test("demo shop opens the owner app with the tab bar", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.getByRole("radio", { name: "English" }).click();
    await page.getByRole("button", { name: "Try the demo shop" }).click();
    await expect(page).toHaveURL("/app");
    await expect(page.getByRole("navigation", { name: /Main sections|मुख्य हिस्से/ })).toBeVisible();
    // Signed in, the sign-in page sends the owner back to the app.
    await page.goto("/");
    await expect(page).toHaveURL("/app");
  });

  test("a new owner picks a language, then lands in the app in it", async ({ page, context }) => {
    const admin = createClient(supabase!.API_URL, supabase!.SECRET_KEY, { auth: { persistSession: false } });
    const email = `owner-${Date.now()}@example.test`;
    const password = `Local-${Math.random().toString(36).slice(2)}-test`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (createError) throw createError;
    const anon = createClient(supabase!.API_URL, supabase!.PUBLISHABLE_KEY, { auth: { persistSession: false } });
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // The @supabase/ssr session cookie, as the Google callback would set it.
    await context.clearCookies();
    await context.addCookies([
      {
        name: "sb-127-auth-token",
        value: "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url"),
        url: `http://localhost:${process.env.E2E_PORT ?? 3200}`,
      },
    ]);

    try {
      await page.goto("/app");
      await expect(page).toHaveURL("/app/welcome");
      await page.getByRole("radio", { name: /English/ }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Choose your language" })).toBeVisible();
      expect(await blockingViolations(page)).toEqual([]);
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page).toHaveURL("/app");
      await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();

      const { data: shop } = await admin.from("shops").select("language").eq("owner_id", created.user.id).single();
      expect(shop?.language).toBe("en");
    } finally {
      await admin.from("shops").delete().eq("owner_id", created.user.id);
      await admin.auth.admin.deleteUser(created.user.id);
    }
  });
});
