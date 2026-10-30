import { execSync } from "node:child_process";

import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Shared helpers for journeys. Backend journeys run only against the local
// Supabase stack (`supabase start`); CI's e2e job has none and skips them.

export async function blockingViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(" ")} [${n.any[0]?.message ?? ""}]`).slice(0, 3).join(", ")}`);
}

// Switches to dark mode and waits for the repaint: right after the switch,
// Chromium can briefly keep inherited text colours from the light theme,
// which axe would measure as a contrast failure no reader ever sees.
export async function darkMode(page: Page) {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForFunction(() => getComputedStyle(document.body).color === "rgb(245, 245, 247)");
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(150);
}

function readLocalSupabase() {
  if (process.env.CI) return null;
  try {
    const out = execSync("pnpm exec supabase status -o json", { stdio: ["ignore", "pipe", "ignore"], timeout: 60_000 }).toString();
    const status = JSON.parse(out.slice(out.indexOf("{"))) as Record<string, string>;
    return status.API_URL?.includes("127.0.0.1") ? status : null;
  } catch {
    return null;
  }
}

export const localSupabase = readLocalSupabase();

export function localAdmin() {
  return createClient(localSupabase!.API_URL, localSupabase!.SECRET_KEY, { auth: { persistSession: false } });
}

export function localAnon() {
  return createClient(localSupabase!.API_URL, localSupabase!.PUBLISHABLE_KEY, { auth: { persistSession: false } });
}

// The demo sign-in allows 10 per IP per hour (doc 03). Each journey gets its
// own test address, so parallel journeys don't share one limit.
export async function ownTestAddress(page: Page) {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
}

// Signs in to a fresh demo shop through the real sign-in screen, in English.
export async function signInToDemo(page: Page) {
  await ownTestAddress(page);
  await page.context().clearCookies();
  await page.goto("/");
  await page.getByRole("radio", { name: "English" }).click();
  await page.getByRole("button", { name: "Try the demo shop" }).click();
  await page.waitForURL("/app");
}

// Signs in as a fresh Google-style owner (email account on the local stack),
// with an empty shop unless `withShop` is false. Returns the user's ID.
export async function signInAsNewOwner(page: Page, { withShop = true, language = "en" } = {}) {
  const admin = localAdmin();
  const email = `owner-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`;
  const password = `Local-${Math.random().toString(36).slice(2)}-test`;
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  if (withShop) {
    const { error: shopError } = await admin
      .from("shops")
      .insert({ owner_id: created.user.id, name: "New Kirana", slug: `new-${created.user.id.slice(0, 8)}`, language });
    if (shopError) throw shopError;
  }
  const { data, error: signInError } = await localAnon().auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  // The @supabase/ssr session cookie, as the Google callback would set it.
  await page.context().clearCookies();
  await page.context().addCookies([
    {
      name: "sb-127-auth-token",
      value: "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url"),
      url: `http://localhost:${process.env.E2E_PORT ?? 3200}`,
    },
  ]);
  return created.user.id;
}

