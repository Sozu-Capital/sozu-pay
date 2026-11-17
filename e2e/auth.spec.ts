import { test, expect } from "@playwright/test";
import { addSession } from "./helpers";

test.describe("Session + sign out", () => {
  test("signed-in home goes to org picker; sign out returns to /?fresh=1", async ({
    page,
    baseURL,
  }) => {
    const origin = baseURL ?? "http://localhost:3010";
    await addSession(page, origin, {
      id: "e2e-session",
      email: "e2e-session@sozupay.demo",
    });

    await page.goto("/");
    await expect(page).toHaveURL(/\/onboarding\/organizations/);

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\?fresh=1/);
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  });

  test("POST /api/auth/logout returns redirect not 405", async ({ request, baseURL }) => {
    const res = await request.fetch(`${baseURL}/api/auth/logout`, {
      method: "POST",
      maxRedirects: 0,
    });
    expect(res.status(), "Logout POST must not be 405").not.toBe(405);
    expect(res.status()).toBeGreaterThanOrEqual(302);
    expect(res.status()).toBeLessThan(400);
  });
});
