import { expect, test, type Page } from "@playwright/test";

import { blockingViolations, localAdmin, localSupabase, signInToDemo } from "./support";

// F-10 review gate: the bill photo (O-10). The photo is resized and loses its
// EXIF (GPS included) before it leaves the phone; the bill reader is replaced
// with a proposal written to the database, so no AI credit is spent.

test.skip(!localSupabase, "needs the local Supabase stack");

function jpegSize(bytes: Buffer): { width: number; height: number } | null {
  let i = 2;
  while (i < bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1];
    if (marker >= 0xc0 && marker <= 0xc2) return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
    i += 2 + bytes.readUInt16BE(i + 2);
  }
  return null;
}

// A 12 MP phone photo with an EXIF block that carries a GPS marker.
async function phonePhoto(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 4032;
    canvas.height = 3024;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 4032, 3024);
    ctx.fillStyle = "#000";
    ctx.font = "120px sans-serif";
    ctx.fillText("Maggi 70g x 24", 200, 400);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.9));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  });
  const jpeg = Buffer.from(base64, "base64");
  const payload = Buffer.concat([Buffer.from("Exif\0\0", "binary"), Buffer.from("GPSLatitude 28.98 N GPSLongitude 77.70 E", "ascii")]);
  const app1 = Buffer.alloc(4);
  app1.writeUInt16BE(0xffe1, 0);
  app1.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([jpeg.subarray(0, 2), app1, payload, jpeg.subarray(2)]);
}

async function shopFor(page: Page) {
  const { shop } = await page.evaluate(() => fetch("/api/v1/shops/me").then((r) => r.json() as Promise<{ shop: { id: string } }>));
  const { data: maggi } = await localAdmin().from("products").select("id").eq("shop_id", shop.id).like("name", "Maggi%").single();
  return { shopId: shop.id, maggiId: maggi!.id };
}

test("a bill photo is resized, loses its EXIF and comes back as changes to check", async ({ page }) => {
  await signInToDemo(page);
  const { shopId, maggiId } = await shopFor(page);
  const { data: proposal } = await localAdmin()
    .from("proposals")
    .insert({
      shop_id: shopId,
      kind: "BILL",
      changes: [
        { op: "record_delivery", product_id: maggiId, qty: 24 },
        { op: "add_product", name: "Haldiram Bhujia", unit: "200 g", stock_qty: 12 },
      ],
    })
    .select("id")
    .single();
  let uploadedPath = "";
  await page.route("**/api/v1/proposals/bill", async (route) => {
    uploadedPath = (route.request().postDataJSON() as { path: string }).path;
    await route.fulfill({ status: 201, json: { proposal: { id: proposal!.id } } });
  });

  await page.getByRole("navigation", { name: "Main sections" }).getByRole("link", { name: "Stock" }).click();
  await page.getByRole("link", { name: "Bill photo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Photo of a supplier's bill" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main sections" })).toBeHidden();
  expect(await blockingViolations(page)).toEqual([]);

  await page.locator('input[type="file"]:not([capture])').setInputFiles({ name: "bill.jpg", mimeType: "image/jpeg", buffer: await phonePhoto(page) });
  await expect(page.getByRole("img", { name: "Your photo" })).toBeVisible();
  await page.getByRole("button", { name: "Use photo" }).click();

  await expect(page).toHaveURL(`/app/check/${proposal!.id}`, { timeout: 20_000 });
  await expect(page.getByText("Delivered 24 × Maggi 2-Minute Noodles")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Add Haldiram Bhujia/ })).toHaveAttribute("aria-checked", "false");

  // What reached Storage: a JPEG in the shop's bill folder, 1600 px at most,
  // with no EXIF and no GPS.
  expect(uploadedPath.startsWith(`${shopId}/bill/`)).toBe(true);
  const { data: file } = await localAdmin().storage.from("photos").download(uploadedPath);
  const stored = Buffer.from(await file!.arrayBuffer());
  expect(stored.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  expect(jpegSize(stored)).toEqual({ width: 1600, height: 1200 });
  expect(stored.includes(Buffer.from("Exif"))).toBe(false);
  expect(stored.includes(Buffer.from("GPSLatitude"))).toBe(false);
});

test("a bill that can't be read says what to do", async ({ page }) => {
  await signInToDemo(page);
  await page.route("**/api/v1/proposals/bill", (route) =>
    route.fulfill({ status: 422, json: { error: { code: "AI_NOT_UNDERSTOOD", message: "x" } } }),
  );
  await page.goto("/app/camera");
  await page.locator('input[type="file"]:not([capture])').setInputFiles("tests/fixtures/bills/printed-1.jpg");
  await page.getByRole("button", { name: "Use photo" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Couldn't read this bill. Try a clearer photo, flat and in good light.");
  // The photo stays, ready to retake or try again.
  await expect(page.getByRole("button", { name: "Retake" })).toBeEnabled();
});

test("Take photo asks for the rear camera", async ({ page }) => {
  await signInToDemo(page);
  await page.goto("/app/camera");
  await expect(page.locator('input[type="file"][capture="environment"]')).toHaveAttribute("accept", "image/*");
});
