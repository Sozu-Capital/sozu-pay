import { test, expect } from "@playwright/test";

const SESSION_COOKIE = "sozupay_session";
const AUTH_SECRET = process.env.AUTH_SECRET ?? "dev-secret-change-in-production";

/** Sign session payload the same way the server does (session.ts). */
function signSession(payload: object): string {
  const value = JSON.stringify(payload);
  const signed = value + "." + AUTH_SECRET;
  return Buffer.from(signed, "utf-8").toString("base64url");
}

test.describe("Auth E2E (mock auth)", () => {
  test("home redirects to dashboard when session exists, logout returns redirect (no 405)", async ({
    page,
    baseURL,
  }) => {
    const mockUser = {
      id: "demo-user-mock",
      email: "demo@sozupay.demo",
      twoFactorEnabled: false,
    };
    const signed = signSession(mockUser);

    const origin = baseURL ?? "http://localhost:3010";
    await page.context().addCookies([
      {
        name: SESSION_COOKIE,
        value: signed,
        url: origin,
      },
    ]);

    let logoutStatus: number | null = null;
    page.on("response", (res) => {
      const url = res.url();
      if (url.includes("/api/auth/logout")) {
        logoutStatus = res.status();
      }
    });

    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/$/);

    expect(logoutStatus, "Logout request must not return 405").not.toBe(405);
    expect(
      logoutStatus,
      "Logout should return redirect (302/307)"
    ).toBeGreaterThanOrEqual(302);
    expect(logoutStatus).toBeLessThan(400);
  });

  test("POST /api/auth/logout returns redirect not 405", async ({
    request,
    baseURL,
  }) => {
    const res = await request.fetch(`${baseURL}/api/auth/logout`, {
      method: "POST",
      maxRedirects: 0,
    });
    expect(res.status(), "Logout POST must not be 405").not.toBe(405);
    expect(
      res.status(),
      "Logout should return redirect (302/307)"
    ).toBeGreaterThanOrEqual(302);
    expect(res.status()).toBeLessThan(400);
  });
});
