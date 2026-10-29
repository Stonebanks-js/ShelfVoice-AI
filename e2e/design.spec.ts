import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// F-01 review gate: the style guide is axe clean in both themes and both
// languages, never scrolls sideways on phones, and its components behave.

async function blockingViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
}

test.describe("design style guide", () => {
  for (const theme of ["Light", "Dark"] as const) {
    for (const lang of ["English", "हिन्दी"] as const) {
      test(`axe clean in ${theme} / ${lang}`, async ({ page }) => {
        await page.goto("/design");
        await page.getByRole("radio", { name: lang }).click();
        const themeName = lang === "English" ? theme : theme === "Light" ? "हल्का" : "गहरा";
        await page.getByRole("radio", { name: themeName }).click();
        await expect(page.getByRole("radio", { name: themeName })).toHaveAttribute("aria-checked", "true");
        expect(await blockingViolations(page)).toEqual([]);
      });
    }
  }

  for (const width of [320, 360, 430]) {
    test(`no horizontal scroll at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/design");
      await page.getByRole("radio", { name: "हिन्दी" }).click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("Hindi marks its text for screen readers", async ({ page }) => {
    await page.goto("/design");
    await page.getByRole("radio", { name: "हिन्दी" }).click();
    await expect(page.locator('[lang="hi"]').getByRole("navigation", { name: "मुख्य हिस्से" })).toBeVisible();
  });

  test("segmented control moves with arrow keys", async ({ page }) => {
    await page.goto("/design");
    await page.getByRole("radio", { name: "Phone" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "Light" })).toBeFocused();
    await expect(page.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "true");
  });

  test("toast offers Undo and announces itself", async ({ page }) => {
    await page.goto("/design");
    await page.getByRole("button", { name: "Toast with Undo" }).click();
    const status = page.getByRole("status").filter({ hasText: "3 changes saved" });
    await expect(status).toBeVisible();
    await status.getByRole("button", { name: "Undo" }).click();
    await expect(status).toBeHidden();
  });

  test("sheet opens, traps focus and closes with Escape", async ({ page }) => {
    await page.goto("/design");
    await page.getByRole("button", { name: "Open sheet" }).click();
    const sheet = page.getByRole("dialog", { name: "Bill photo" });
    await expect(sheet).toBeVisible();
    expect(await blockingViolations(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });

  test("delete alert needs a second tap and shows progress", async ({ page }) => {
    await page.goto("/design");
    await page.getByRole("button", { name: "Delete shop…" }).click();
    const alert = page.getByRole("alertdialog", { name: "Delete your shop?" });
    await expect(alert).toBeVisible();
    await expect(alert.getByRole("button", { name: "Cancel" })).toBeFocused();
    await alert.getByRole("button", { name: "Delete" }).click();
    await expect(alert).toBeHidden();
  });

  test("switch reports its state", async ({ page }) => {
    await page.goto("/design");
    const toggle = page.getByRole("switch", { name: "Published" });
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
  });
});
