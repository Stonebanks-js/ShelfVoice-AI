import { expect, test, type Page } from "@playwright/test";

import { blockingViolations, darkMode, localAdmin, localSupabase, signInToDemo } from "./support";

// F-03b review gate (doc 04 "Upload interrupted"; doc 06 offline state): a
// voice note recorded without a connection waits on the phone with a clock,
// and is sent by itself when the connection comes back. The AI step is
// mocked, so no Meta credit is spent.

test.skip(!localSupabase, "needs the local Supabase stack");

async function demoWithMockedVoice(page: Page) {
  await signInToDemo(page);
  const { shop } = await page.evaluate(() => fetch("/api/v1/shops/me").then((r) => r.json() as Promise<{ shop: { id: string } }>));
  const { data: maggi } = await localAdmin().from("products").select("id").eq("shop_id", shop.id).like("name", "Maggi%").single();
  const { data: proposal } = await localAdmin()
    .from("proposals")
    .insert({ shop_id: shop.id, kind: "COMMAND", transcript: "Maggi do packet bike", changes: [{ op: "record_sale", product_id: maggi!.id, qty: 2 }] })
    .select("id")
    .single()
    .throwOnError();
  const paths: string[] = [];
  await page.route("**/api/v1/proposals/voice", async (route) => {
    paths.push((route.request().postDataJSON() as { path: string }).path);
    await route.fulfill({ status: 201, json: { proposal: { id: proposal!.id }, question: null, rejected: [] } });
  });
  await page.evaluate(() => localStorage.setItem("sv_mic_primed", "1"));
  return { shopId: shop.id, proposalId: proposal!.id, paths };
}

async function speak(page: Page) {
  const nav = page.getByRole("navigation", { name: "Main sections" });
  await nav.getByRole("button", { name: "Tap to speak" }).click();
  await expect(nav.getByRole("button", { name: "Recording, tap to stop" })).toBeVisible();
  await page.waitForTimeout(1200);
  await nav.getByRole("button", { name: "Recording, tap to stop" }).click();
}

const queued = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const open = indexedDB.open("shelfvoice", 1);
        open.onupgradeneeded = () => open.result.createObjectStore("clips", { keyPath: "clientId" });
        open.onsuccess = () => {
          const count = open.result.transaction("clips").objectStore("clips").count();
          count.onsuccess = () => {
            resolve(count.result);
            open.result.close();
          };
        };
      }),
  );

test("a voice note recorded offline waits, then sends when the phone reconnects", async ({ page, context }) => {
  const { shopId, proposalId, paths } = await demoWithMockedVoice(page);

  await context.setOffline(true);
  const bar = page.getByRole("status").filter({ hasText: "Offline. Recordings will send when you're back online." });
  await expect(bar).toBeVisible();

  await speak(page);
  await expect(bar).toContainText("1 recording waiting.");
  // No error: the mic is ready for the next note.
  const nav = page.getByRole("navigation", { name: "Main sections" });
  await expect(nav.getByRole("alert")).toBeHidden();
  await expect(nav.getByRole("button", { name: "Tap to speak" })).toBeVisible();
  expect(await queued(page)).toBe(1);
  expect(await blockingViolations(page)).toEqual([]);
  await darkMode(page);
  expect(await blockingViolations(page)).toEqual([]);

  await context.setOffline(false);
  const sent = page.getByRole("status").filter({ hasText: "Voice note sent." });
  await expect(sent).toBeVisible({ timeout: 20_000 });
  await expect(bar).toBeHidden();
  expect(await queued(page)).toBe(0);
  expect(paths).toHaveLength(1);
  expect(paths[0].startsWith(`${shopId}/owner/`)).toBe(true);
  const { data: files } = await localAdmin().storage.from("voice").list(`${shopId}/owner`);
  expect(files?.some((f) => paths[0].endsWith(f.name))).toBe(true);

  await sent.getByRole("button", { name: "Check" }).click();
  await expect(page).toHaveURL(`/app/check/${proposalId}`);
});

test("an upload cut off midway is kept and retried by itself", async ({ page }) => {
  const { paths } = await demoWithMockedVoice(page);
  // The first upload to Storage drops, as a lost signal would.
  let attempts = 0;
  await page.route("**/storage/v1/object/upload/sign/**", (route) => {
    attempts += 1;
    return attempts === 1 ? route.abort("internetdisconnected") : route.continue();
  });

  await speak(page);
  const waiting = page.getByRole("status").filter({ hasText: "1 recording waiting." });
  await expect(waiting).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("navigation", { name: "Main sections" }).getByRole("alert")).toBeHidden();

  // Retried after the 5-second back-off, with the same file name.
  await expect(page.getByRole("status").filter({ hasText: "Voice note sent." })).toBeVisible({ timeout: 20_000 });
  expect(attempts).toBe(2);
  expect(paths).toHaveLength(1);
  expect(await queued(page)).toBe(0);
});
