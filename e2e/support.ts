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
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
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
