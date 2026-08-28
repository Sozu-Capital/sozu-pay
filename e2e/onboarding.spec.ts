import { test, expect } from "@playwright/test";
import { addSession } from "./helpers";

test.describe("Org type picker", () => {
  test("create-org requires Store with POS vs Distribution platform", async ({
    page,
    baseURL,
  }) => {
    const origin = baseURL ?? "http://localhost:3010";
    await addSession(page, origin, {
      id: "e2e-type-picker",
      email: "e2e-picker@sozupay.demo",
    });

    await page.goto("/onboarding/create-organization");
    await expect(page.getByRole("heading", { name: "What are you creating?" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText(/This Google account can create one organization/i),
    ).toBeVisible();

    await page.getByRole("button", { name: /Store with POS/i }).click();
    await expect(page.getByRole("heading", { name: "What are you creating?" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Choose a different type" })).toBeVisible();

    await page.getByRole("button", { name: "Choose a different type" }).click();
    await expect(page.getByRole("heading", { name: "What are you creating?" })).toBeVisible();

    await page.getByRole("button", { name: /Distribution platform/i }).click();
    await expect(page.getByRole("heading", { name: "What are you creating?" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Choose a different type" })).toBeVisible();
  });
});
