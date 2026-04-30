import { defineConfig, devices } from "@playwright/test";

const E2E_PORT = process.env.E2E_PORT ?? "3010";

/**
 * E2E tests run against the local dev server with mock auth (no Privy).
 * Auth tests verify login → dashboard → logout without 405.
 * Uses port 3010 by default so it doesn't conflict with a dev server on 3000.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev -p ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      AUTH_MOCK: "true",
      NEXT_PUBLIC_PRIVY_APP_ID: "",
      PRIVY_APP_ID: "",
    },
  },
});
