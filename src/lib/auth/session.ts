/**
 * Session handling – server-side only.
 * Uses signed cookie; in production use AUTH_SECRET. Magic link / OTP verify sets session.
 */

import { cookies } from "next/headers";
import {
  buildSessionCookieValue,
  getSessionCookieOptions,
  parseSessionCookie,
  SESSION_COOKIE,
} from "@/lib/auth/session-cookie";

export { SESSION_COOKIE };

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const AUTH_PROVIDER =
  process.env.NEXT_PUBLIC_AUTH_PROVIDER ??
  process.env.AUTH_PROVIDER ??
  (PRIVY_APP_ID ? "privy" : "passkey");
const usePrivyAuth = AUTH_PROVIDER === "privy" && !!PRIVY_APP_ID;
const usePasskeyAuth = AUTH_PROVIDER === "passkey" || !usePrivyAuth;

export interface SessionUser {
  /** Numeric user id (passkey) or legacy Privy subject id. */
  id: string;
  email: string;
  /** Sozu tag when using passkey auth. */
  username?: string;
  twoFactorEnabled?: boolean;
  /** Selected organization to manage; set after user picks on org selection page. */
  orgId?: string | null;
}

const MOCK_USER: SessionUser = {
  id: "demo-user-mock",
  email: "demo@sozupay.demo",
  twoFactorEnabled: false,
};

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const parsed = parseSessionCookie(cookieStore.get(SESSION_COOKIE)?.value);
  if (parsed) return parsed;
  // Mock auth only when real auth providers are disabled (aligned with middleware).
  const authMock =
    !usePrivyAuth &&
    !usePasskeyAuth &&
    (process.env.AUTH_MOCK === "true" ||
      (process.env.AUTH_MOCK !== "false" && process.env.NODE_ENV === "development"));
  if (authMock) return MOCK_USER;
  return null;
}

export async function setSession(user: SessionUser): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, buildSessionCookieValue(user), getSessionCookieOptions());
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", { ...getSessionCookieOptions(), maxAge: 0 });
}
