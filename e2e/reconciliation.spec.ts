import { test, expect } from "@playwright/test";
import { addEnglishLocale, addSession, signSession, SESSION_COOKIE } from "./helpers";

test.describe("Store reconciliation API", () => {
  test("logged-out GET is 401", async ({ request, baseURL }) => {
    const origin = baseURL ?? "http://localhost:3010";
    const res = await request.get(`${origin}/api/store/reconciliation`);
    expect(res.status()).toBe(401);
  });

  test("CSV without a session is 401", async ({ request, baseURL }) => {
    const origin = baseURL ?? "http://localhost:3010";
    const res = await request.get(`${origin}/api/store/reconciliation?format=csv`);
    expect(res.status()).toBe(401);
  });

  test("session without an org is 401", async ({ request, baseURL }) => {
    const origin = baseURL ?? "http://localhost:3010";
    const res = await request.get(`${origin}/api/store/reconciliation`, {
      headers: {
        cookie: `${SESSION_COOKIE}=${signSession({
          id: "e2e-recon",
          email: "e2e-recon@sozupay.demo",
        })}`,
      },
    });
    expect(res.status()).toBe(401);
  });

  test("create-org is gated when logged out", async ({ page, context, baseURL }) => {
    await addEnglishLocale(context, baseURL ?? "http://localhost:3010");
    await page.goto("/onboarding/create-organization");
    await expect(page).toHaveURL(/returnTo=.*create-organization/);
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  });

  test("transactions page is gated without orgId", async ({ page, baseURL }) => {
    const origin = baseURL ?? "http://localhost:3010";
    await addSession(page, origin, {
      id: "e2e-recon-nav",
      email: "e2e-recon-nav@sozupay.demo",
    });
    await page.goto("/dashboard/transactions");
    await expect(page).toHaveURL(/onboarding\/organizations/);
  });
});
