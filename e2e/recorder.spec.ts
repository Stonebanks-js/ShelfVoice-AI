import { expect, test } from "@playwright/test";

import { blockingViolations } from "./support";

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

// The owner's mic journey, from recording to Check and confirm, is in
// check-confirm.spec.ts, with the AI step mocked so it never spends credit.
