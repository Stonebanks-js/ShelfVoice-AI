import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const base = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  TURNSTILE_SECRET_KEY: "turnstile-secret",
};

const deployedExtras = {
  AXIOM_TOKEN: "axiom",
  AXIOM_DATASET: "shelfvoice",
  BETTERSTACK_HEARTBEAT_URL: "https://uptime.example/hb",
  DISCORD_ALERT_WEBHOOK_URL: "https://discord.example/hook",
  CRON_SECRET: "x".repeat(32),
  ADMIN_EMAILS: "A@Example.com, b@example.com",
};

// The schema reads VERCEL_ENV when the module loads, so each case re-imports it.
async function load(vars: Record<string, string>) {
  vi.unstubAllEnvs();
  for (const key of Object.keys(process.env)) {
    if (key in base || key in deployedExtras || key.startsWith("META_") || key.startsWith("AI_")) {
      vi.stubEnv(key, undefined);
    }
  }
  vi.stubEnv("VERCEL_ENV", undefined);
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
  vi.resetModules();
  return import("./schema");
}

describe("server env schema", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllEnvs());

  it("applies the doc 08 and errata E-06 defaults", async () => {
    const { parseServerEnv } = await load(base);
    const env = parseServerEnv();
    expect(env.META_MODE).toBe("recorded");
    expect(env.META_BASE_URL).toBe("https://api.meta.ai/v1");
    expect(env.AI_TOTAL_BUDGET_USD).toBe(100);
    expect(env.AI_DAILY_BUDGET_USD).toBe(15);
    expect(env.AI_SHOP_DAILY_BUDGET_USD).toBe(2);
  });

  it("names every missing variable in one error", async () => {
    const { parseServerEnv } = await load({});
    expect(parseServerEnv).toThrow(/NEXT_PUBLIC_SUPABASE_URL[\s\S]*SUPABASE_SERVICE_ROLE_KEY/);
  });

  it.each(["live", "replay-demo"])("requires META_API_KEY when META_MODE is %s", async (mode) => {
    const { parseServerEnv } = await load({ ...base, META_MODE: mode });
    expect(parseServerEnv).toThrow(/META_API_KEY/);
  });

  it("treats an empty META_API_KEY as missing", async () => {
    const { parseServerEnv } = await load({ ...base, META_MODE: "live", META_API_KEY: "" });
    expect(parseServerEnv).toThrow(/META_API_KEY/);
  });

  it("rejects a total budget above the $150 credit", async () => {
    const { parseServerEnv } = await load({ ...base, AI_TOTAL_BUDGET_USD: "200" });
    expect(parseServerEnv).toThrow(/AI_TOTAL_BUDGET_USD/);
  });

  it("allows observability and admin values to be missing locally", async () => {
    const { parseServerEnv } = await load(base);
    expect(parseServerEnv().CRON_SECRET).toBeUndefined();
  });

  it("requires observability and admin values on Vercel", async () => {
    const { parseServerEnv } = await load({ ...base, VERCEL_ENV: "preview" });
    expect(parseServerEnv).toThrow(/AXIOM_TOKEN[\s\S]*CRON_SECRET[\s\S]*ADMIN_EMAILS/);
  });

  it("normalises the admin allow-list on Vercel", async () => {
    const { parseServerEnv } = await load({ ...base, ...deployedExtras, VERCEL_ENV: "production" });
    expect(parseServerEnv().ADMIN_EMAILS).toEqual(["a@example.com", "b@example.com"]);
  });

  it("rejects a short CRON_SECRET on Vercel", async () => {
    const { parseServerEnv } = await load({
      ...base,
      ...deployedExtras,
      CRON_SECRET: "short",
      VERCEL_ENV: "production",
    });
    expect(parseServerEnv).toThrow(/CRON_SECRET/);
  });
});
