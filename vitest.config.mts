import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      // Coverage gate where bugs cost most: server services and the forecast
      // module, which lives under src/server (doc 04, V4). UI is covered by E2E.
      include: ["src/server/**/*.ts"],
      exclude: ["**/*.test.ts"],
      thresholds: { lines: 80 },
      reporter: ["text", "json-summary"],
    },
  },
});
