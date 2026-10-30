import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { blockingViolations, darkMode, localAdmin, localSupabase, ownTestAddress, signInAsNewOwner, signInToDemo } from "./support";

// F-12 review gate: the admin page (A-1, W-20b) is a real 404 to everyone not
// on ADMIN_EMAILS (set for these runs in playwright.config.ts), shows today's
// numbers to the team, and its switch pauses and resumes AI.

async function signInAsAdmin(page: Page, testInfo: TestInfo) {
  await signInAsNewOwner(page, { withShop: false, email: `admin-${testInfo.project.name}@example.test` });
}

async function expectHidden(page: Page) {
  expect((await page.goto("/admin"))!.status()).toBe(404);
  const api = await page.request.post("/api/v1/admin/breaker", { data: { open: true } });
  expect(api.status()).toBe(404);
}

test("signed out, the admin page and its API don't exist", async ({ page }) => {
  await expectHidden(page);
});

test.describe("with the local stack", () => {
  test.skip(!localSupabase, "needs the local Supabase stack");

  test("owners and demo visitors get a 404", async ({ page }) => {
    await signInAsNewOwner(page);
    await expectHidden(page);
    await ownTestAddress(page);
    await page.context().clearCookies();
    await signInToDemo(page);
    await expectHidden(page);
  });

  test("an admin sees today's numbers", async ({ page }, testInfo) => {
    // Something to count: an AI call today.
    await localAdmin().from("ai_calls").insert({ job: "COMMAND", model: "muse-spark-1.3", cost_usd: 0.002, latency_ms: 1800, outcome: "OK" });

    await signInAsAdmin(page, testInfo);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Admin" })).toBeVisible();
    await expect(page.getByText(/^Today in India · /)).toBeVisible();
    await expect(page.getByRole("meter", { name: "Share of the AI budget used" })).toHaveAttribute("aria-valuemax", "100");
    await expect(page.getByText(/Today \$\d+\.\d\d of the \$\d+\.\d\d daily cap/)).toBeVisible();
    await expect(page.getByText("Voice command", { exact: true })).toBeVisible();
    await expect(page.getByText(/\d+ calls? · \$\d+\.\d\d · p95 \d+\.\d s/).first()).toBeVisible();
    await expect(page.getByText("Confirmed as proposed")).toBeVisible();
    await expect(page.getByText("Demo sign-ins")).toBeVisible();
    await expect(page.getByText(/^\d+ · \d+ new today$/)).toBeVisible();
    expect(await page.locator("meta[name=robots]").getAttribute("content")).toContain("noindex");
    expect(await blockingViolations(page)).toEqual([]);
    await darkMode(page);
    expect(await blockingViolations(page)).toEqual([]);
  });

  test("the switch pauses AI after asking, and resumes it", async ({ page }, testInfo) => {
    // One project only: both would share the one Meta breaker.
    test.skip(testInfo.project.name !== "phone-360", "the breaker is shared");
    const manual = async () => (await localAdmin().from("ai_breaker").select("manual").eq("provider", "meta").maybeSingle()).data?.manual ?? false;
    try {
      await signInAsAdmin(page, testInfo);
      await page.goto("/admin");
      const pause = page.getByRole("switch", { name: "Pause AI" });
      await expect(pause).not.toBeChecked();

      // Cancel leaves it running.
      await pause.click();
      const dialog = page.getByRole("alertdialog", { name: "Pause all AI?" });
      await expect(dialog).toBeVisible();
      expect(await blockingViolations(page)).toEqual([]);
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toBeHidden();
      expect(await manual()).toBe(false);

      await pause.click();
      await dialog.getByRole("button", { name: "Pause AI" }).click();
      await expect(pause).toBeChecked();
      await expect(page.getByText("Paused", { exact: true })).toBeVisible();
      expect(await manual()).toBe(true);
      await page.reload();
      await expect(page.getByRole("switch", { name: "Pause AI" })).toBeChecked();

      await page.getByRole("switch", { name: "Pause AI" }).click();
      await expect(page.getByText("Running", { exact: true })).toBeVisible();
      expect(await manual()).toBe(false);
    } finally {
      await localAdmin().from("ai_breaker").update({ state: "CLOSED", manual: false, failures: 0, opened_at: null }).eq("provider", "meta");
    }
  });
});
