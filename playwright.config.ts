import { defineConfig, devices } from "@playwright/test";

const E2E_PORT = process.env.E2E_PORT ?? "3010";
const E2E_AUTH_SECRET = "e2e-auth-secret";

/**
 * Local feature suite. Preview deploys cannot complete Pollar Google OAuth
 * because the callback URL is not on the Pollar allowlist. This server forces
 * fake Pollar (`NEXT_PUBLIC_POLLAR_FAKE_AUTH`) so Google login is deterministic
 * on localhost.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  timeout: 45_000,
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev -p ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      AUTH_MOCK: "false",
      AUTH_SECRET: E2E_AUTH_SECRET,
      SESSION_COOKIE_NAME: "sozupay_session",
      STELLAR_NETWORK: "testnet",
      POLLAR_FAKE_AUTH: "true",
      NEXT_PUBLIC_POLLAR_FAKE_AUTH: "true",
      NEXT_PUBLIC_POLLAR_FAKE_SUBJECT: "e2e-local",
      NEXT_PUBLIC_PRIVY_APP_ID: "",
      PRIVY_APP_ID: "",
    },
  },
});
