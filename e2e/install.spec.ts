import { expect, test } from "@playwright/test";

// The app can be installed on a phone ("Install app" in Chrome on Android) and
// the Android app (a Trusted Web Activity) can prove it belongs to this site.
// Chrome reports its own installability checks through the DevTools protocol.
test("Chrome finds the app installable", async ({ page }) => {
  await page.goto("/");
  const cdp = await page.context().newCDPSession(page);
  const manifest = await cdp.send("Page.getAppManifest");
  expect(manifest.errors).toEqual([]);
  expect(manifest.url).toMatch(/\/manifest\.webmanifest$/);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  expect(installabilityErrors).toEqual([]);
});

test("the manifest, icons and asset links are served", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "Shelf Voice", start_url: "/", display: "standalone" });
  for (const icon of manifest.icons as Array<{ src: string; sizes: string }>) {
    const response = await request.get(icon.src);
    expect(response.headers()["content-type"], icon.src).toBe("image/png");
  }
  const links = await (await request.get("/.well-known/assetlinks.json")).json();
  expect(links[0].target).toMatchObject({ namespace: "android_app", package_name: "app.vercel.shelfvoice.twa" });
  expect(links[0].target.sha256_cert_fingerprints[0]).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
});
