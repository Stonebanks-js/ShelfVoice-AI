import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3200);

// Doc 04: journeys run at a 360 px phone viewport and a 1280 px desktop
// viewport. Voice journeys use Chromium's fake microphone (a steady tone,
// permission granted without a prompt), so every project uses Chromium.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Locally, journeys share one laptop with Docker and the production server;
  // more workers starve the local Supabase stack and make uploads time out.
  workers: process.env.CI ? undefined : 4,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
  },
  projects: [
    {
      name: "phone-360",
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true },
    },
    {
      name: "desktop-1280",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${port}`,
    // Journeys never spend Meta credit: an AI call they forget to mock fails
    // fast on a missing recording instead of reaching the live API.
    env: { META_MODE: "recorded" },
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
