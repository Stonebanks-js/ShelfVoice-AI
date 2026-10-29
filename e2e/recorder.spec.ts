import { expect, test } from "@playwright/test";

import { blockingViolations, localAdmin, localSupabase, signInToDemo } from "./support";

// F-03 review gate: the mic records, explains itself the first time, stops,
// and says what went wrong in plain words. The style guide's live recorder
// needs no backend; the upload journey runs on the local Supabase stack.

test.describe("recorder on the style guide", () => {
  test("first tap explains the mic, then records a 16 kHz WAV", async ({ page }) => {
    await page.goto("/design");
    const mic = page.getByTestId("live-recorder").getByRole("button", { name: "Tap to speak" });
    await mic.click();

    const primer = page.getByRole("dialog", { name: "Speak to your shop" });
    await expect(primer).toBeVisible();
    await expect(primer).toContainText("asks for your microphone");
    expect(await blockingViolations(page)).toEqual([]);
    await primer.getByRole("button", { name: "Start speaking" }).click();

    const recording = page.getByTestId("live-recorder").getByRole("button", { name: "Recording, tap to stop" });
    await expect(recording).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(1500);
    await recording.click();
    await expect(page.getByTestId("clip-info")).toContainText(/^\d+\.\d s · 16 kHz mono WAV/);

    // The tip shows only once.
    await page.getByTestId("live-recorder").getByRole("button", { name: "Tap to speak" }).click();
    await expect(page.getByTestId("live-recorder").getByRole("button", { name: "Recording, tap to stop" })).toBeVisible();
    await expect(primer).toBeHidden();
    await page.getByTestId("live-recorder").getByRole("button", { name: "Recording, tap to stop" }).click();
  });

  test("stops by itself at the limit", async ({ page }) => {
    test.setTimeout(45_000);
    await page.addInitScript(() => localStorage.setItem("sv_mic_primed", "1"));
    await page.goto("/design");
    await page.getByTestId("live-recorder").getByRole("button", { name: "Tap to speak" }).click();
    await expect(page.getByTestId("live-recorder").getByRole("button", { name: "Recording, tap to stop" })).toBeVisible();
    await page.waitForTimeout(16_000); // the style guide's limit is 15 s
    await expect(page.getByTestId("live-recorder").getByRole("button", { name: "Tap to speak" })).toBeVisible();
    await expect(page.getByTestId("clip-info")).toContainText("16 kHz mono WAV");
  });

  test("a mis-tap asks the owner to try again", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("sv_mic_primed", "1"));
    await page.goto("/design");
    // Stop in the same moment recording starts, as a double tap would, so the
    // clip is under half a second however busy the test machine is.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const root = document.querySelector('[data-testid="live-recorder"]')!;
          const observer = new MutationObserver(() => {
            const recording = root.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
            if (!recording) return;
            observer.disconnect();
            recording.click();
            resolve();
          });
          observer.observe(root, { subtree: true, attributes: true, childList: true });
          root.querySelector<HTMLButtonElement>('button[aria-label="Tap to speak"]')!.click();
        }),
    );
    await expect(page.getByTestId("live-recorder").getByRole("alert")).toHaveText("Couldn't hear you. Try again closer to the phone.");
  });

  test("explains a blocked microphone", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("sv_mic_primed", "1");
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("blocked", "NotAllowedError"));
    });
    await page.goto("/design");
    await page.getByTestId("live-recorder").getByRole("button", { name: "Tap to speak" }).click();
    await expect(page.getByTestId("live-recorder").getByRole("alert")).toContainText("needs the microphone");
  });
});

test.describe("owner mic", () => {
  test.skip(!localSupabase, "needs the local Supabase stack");

  test("records a command and stores it in the shop's voice folder", async ({ page }) => {
    await signInToDemo(page);

    const nav = page.getByRole("navigation", { name: "Main sections" });
    await nav.getByRole("button", { name: "Tap to speak" }).click();
    await page.getByRole("dialog", { name: "Speak to your shop" }).getByRole("button", { name: "Start speaking" }).click();
    await expect(nav.getByRole("button", { name: "Recording, tap to stop" })).toHaveAttribute("aria-pressed", "true");
    await expect(nav.getByText(/^0:\d\d \/ 0:30$/)).toBeVisible(); // timer against the 30-second limit
    await page.waitForTimeout(1500); // more than the half-second mis-tap threshold
    await nav.getByRole("button", { name: "Recording, tap to stop" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Recording sent" })).toBeVisible({ timeout: 15_000 });

    // This session's own shop (other journeys make demo shops in parallel).
    const { shop } = await page.evaluate(() => fetch("/api/v1/shops/me").then((r) => r.json() as Promise<{ shop: { id: string } }>));
    const { data: files } = await localAdmin().storage.from("voice").list(`${shop.id}/owner`);
    expect(files?.some((f) => f.name.endsWith(".wav"))).toBe(true);
  });
});
