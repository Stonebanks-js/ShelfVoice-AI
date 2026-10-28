import { execSync } from "node:child_process";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Integration tests talk to the local Supabase stack. Its URL and keys are
// read from `supabase status` at startup rather than stored in the repo; if
// no stack is running, placeholders let the pure unit tests run alone.
function localSupabase() {
  try {
    const out = execSync("pnpm exec supabase status -o json", { stdio: ["ignore", "pipe", "ignore"], timeout: 60_000 }).toString();
    const status = JSON.parse(out.slice(out.indexOf("{"))) as Record<string, string>;
    return {
      NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
      SUPABASE_SERVICE_ROLE_KEY: status.SECRET_KEY,
    };
  } catch {
    return {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "no-local-stack",
      SUPABASE_SERVICE_ROLE_KEY: "no-local-stack",
    };
  }
}
const LOCAL_SUPABASE = localSupabase();

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
    // Integration tests share one local database; run files one at a time.
    fileParallelism: false,
    env: {
      ...LOCAL_SUPABASE,
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
      META_MODE: process.env.META_MODE ?? "recorded",
      CRON_SECRET: "test-cron-secret-with-at-least-32-characters",
    },
    coverage: {
      provider: "v8",
      // Coverage gate where bugs cost most: server services and the forecast
      // module, which lives under src/server (doc 04, V4). UI is covered by E2E.
      include: ["src/server/**/*.ts"],
      // Request-scoped glue that needs a live Next request (cookies) is
      // exercised by scripts/smoke-api.mjs instead.
      exclude: ["**/*.test.ts", "src/server/owner.ts"],
      thresholds: { lines: 80 },
      reporter: ["text", "json-summary"],
    },
  },
});
