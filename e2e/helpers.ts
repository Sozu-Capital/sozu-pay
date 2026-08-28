import { createHmac } from "crypto";
import type { BrowserContext, Page } from "@playwright/test";

export const E2E_AUTH_SECRET = "e2e-auth-secret";
export const SESSION_COOKIE = "sozupay_session";
export const LOCALE_COOKIE = "sozupay_locale";

export type E2eSession = {
  id: string;
  email: string;
  orgId?: string | null;
};

export function signSession(user: E2eSession): string {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  const sig = createHmac("sha256", E2E_AUTH_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export async function addEnglishLocale(context: BrowserContext, origin: string) {
  await context.addCookies([
    { name: LOCALE_COOKIE, value: "en", url: origin },
  ]);
}

export async function addSession(page: Page, origin: string, user: E2eSession) {
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: signSession(user), url: origin },
    { name: LOCALE_COOKIE, value: "en", url: origin },
  ]);
}
