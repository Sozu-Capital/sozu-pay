import { test, expect } from "@playwright/test";
import { addEnglishLocale } from "./helpers";

test.describe("One Pollar door (local, fake Google)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await addEnglishLocale(context, baseURL ?? "http://localhost:3010");
  });

  test("landing is a neutral door: Google primary, passkey recovery, no Create account", async ({
    page,
  }) => {
    await page.goto("/?fresh=1");

    await expect(page.getByRole("heading", { name: /Payments and distribution on Stellar/i })).toBeVisible();
    await expect(page.getByText(/Run a store with POS or a distribution program/i)).toBeVisible();

    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByText(/Dev mode: Google is simulated/i)).toBeVisible();
    await expect(page.getByText(/Already have a passkey account/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with passkey" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Use PIN instead" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Create account" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /staff invite/i })).toBeVisible();
  });

  test("passkey recovery does not open a new-account form", async ({ page }) => {
    await page.goto("/?fresh=1");
    await page.getByRole("button", { name: "Continue with passkey" }).click();
    await expect(page.getByRole("button", { name: "Continue with passkey" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Create passkey" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  });

  test("/merchants and /login redirect to / and keep returnTo", async ({ request, baseURL }) => {
    const origin = baseURL ?? "http://localhost:3010";

    const merchants = await request.fetch(`${origin}/merchants`, { maxRedirects: 0 });
    expect(merchants.status()).toBe(307);
    expect(merchants.headers()["location"]).toBe("/");

    const withReturn = await request.fetch(`${origin}/merchants?returnTo=%2Fdashboard`, {
      maxRedirects: 0,
    });
    expect(withReturn.status()).toBe(307);
    expect(withReturn.headers()["location"]).toBe("/?returnTo=%2Fdashboard");

    const merchant = await request.fetch(`${origin}/merchant`, { maxRedirects: 0 });
    expect(merchant.status()).toBe(307);
    expect(merchant.headers()["location"]).toBe("/");

    const login = await request.fetch(`${origin}/login`, { maxRedirects: 0 });
    expect(login.status()).toBe(307);
    expect(login.headers()["location"]).toBe("/");
  });

  test("fake Google login reaches onboarding without a Pollar redirect-URI match", async ({
    page,
  }) => {
    await page.goto("/?fresh=1");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page).toHaveURL(/\/onboarding\//, { timeout: 45_000 });
  });
});
