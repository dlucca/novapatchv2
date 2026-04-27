import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "bun run dev",
    url: "http://localhost:3000/mx",
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_API_URL: "http://localhost:3000/api",
    },
  },
});
