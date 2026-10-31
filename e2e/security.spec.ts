import { expect, test, type Page } from "@playwright/test";

import { localSupabase, signInToDemo } from "./support";

// F-13 review gate: security headers on every page, no Content Security
// Policy violations across the main screens, and browser errors reaching
// the server (and so Axiom) without user text.

function watchCsp(page: Page): string[] {
  const violations: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (/Content Security Policy|Refused to (load|execute|connect|frame|apply)/i.test(text)) violations.push(text.slice(0, 200));
  });
  return violations;
}

test("security headers are on every page", async ({ page }) => {
  const res = await page.goto("/");
  const headers = res!.headers();
  const csp = headers["content-security-policy"];
  for (const directive of ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'"]) {
    expect(csp).toContain(directive);
  }
  expect(csp).toContain("https://challenges.cloudflare.com"); // Turnstile
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["strict-transport-security"]).toContain("max-age=63072000");
  expect(headers["permissions-policy"]).toContain("microphone=(self)");
  expect(headers["permissions-policy"]).toContain("geolocation=()");
});

test("the style guide's recorder works under the CSP", async ({ page }) => {
  const violations = watchCsp(page);
  await page.addInitScript(() => localStorage.setItem("sv_mic_primed", "1"));
  await page.goto("/design");
  const mic = page.getByTestId("live-recorder").getByRole("button", { name: "Tap to speak" });
  await mic.click();
  await page.waitForTimeout(1200);
  await page.getByTestId("live-recorder").getByRole("button", { name: "Recording, tap to stop" }).click();
  await expect(page.getByTestId("clip-info")).toContainText("16 kHz mono WAV");
  expect(violations).toEqual([]);
});

test("browser errors are reported without noise", async ({ page }) => {
  // Record what the page sends (Playwright doesn't expose beacon bodies),
  // then let the beacon go out as normal.
  await page.addInitScript(() => {
    const sent: string[] = [];
    (window as unknown as { sent: string[] }).sent = sent;
    const original = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => {
      if (String(url).endsWith("/api/v1/client-errors") && data instanceof Blob) void data.text().then((t) => sent.push(t));
      return original(url, data);
    };
  });
  await page.goto("/design");
  await page.evaluate(() => {
    // Noise first (a browser extension), then a real error from our page.
    window.dispatchEvent(new ErrorEvent("error", { message: "x is not a function", filename: "chrome-extension://abc/content.js" }));
    setTimeout(() => {
      throw new Error("boom from a test");
    });
  });
  const errors = () => page.evaluate(() => (window as unknown as { sent: string[] }).sent.filter((t) => t.includes('"type":"error"')));
  await expect.poll(errors).toHaveLength(1);
  expect(JSON.parse((await errors())[0])).toMatchObject({ type: "error", page: "/design", message: expect.stringContaining("boom from a test") });
});

test.describe("with the local stack", () => {
  test.skip(!localSupabase, "needs the local Supabase stack");

  // The rate limiter lives in the database, so this needs the local stack.
  // Its own test address: every page in a full run sends Web Vitals from
  // the shared local one, which can use up its 60 a minute.
  test("the error endpoint accepts reports and refuses junk and other sites", async ({ playwright }) => {
    const octet = () => Math.floor(Math.random() * 254) + 1;
    const request = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
      extraHTTPHeaders: { "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` },
    });
    expect((await request.post("/api/v1/client-errors", { data: { type: "error", page: "/", message: "x" } })).status()).toBe(204);
    expect((await request.post("/api/v1/client-errors", { data: { type: "vital", page: "/", name: "LCP", value: 1234.5, rating: "good" } })).status()).toBe(204);
    expect((await request.post("/api/v1/client-errors", { data: { type: "error", page: "/" } })).status()).toBe(422);
    const cross = await request.post("/api/v1/client-errors", {
      headers: { origin: "https://evil.example" },
      data: { type: "error", page: "/", message: "x" },
    });
    await request.dispose();
    expect(cross.status()).toBe(403);
  });

  test("no CSP violations across the owner app and the public pages", async ({ page, context }) => {
    const violations = watchCsp(page);
    await signInToDemo(page);
    const { shop } = await page.evaluate(() => fetch("/api/v1/shops/me").then((r) => r.json() as Promise<{ shop: { slug: string } }>));
    for (const path of ["/app", "/app/stock", "/app/orders", "/app/reviews", "/app/shop", "/app/camera"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    await context.clearCookies();
    await page.goto(`/s/${shop.slug}`);
    await page.waitForLoadState("networkidle");
    // The real Turnstile script loads from Cloudflare under the CSP.
    await page.goto(`/r/${shop.slug}`);
    await expect.poll(() => page.evaluate(() => typeof (window as unknown as { turnstile?: unknown }).turnstile), { timeout: 15_000 }).toBe("object");
    expect(violations).toEqual([]);
  });
});
