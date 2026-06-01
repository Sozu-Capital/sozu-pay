/**
 * Session handling – server-side only.
 * Uses signed cookie; in production use AUTH_SECRET.
 */

import { cookies } from "next/headers";
import {
  buildSessionCookieValue,
  getSessionCookieOptions,
  parseSessionCookie,
} from "@/lib/auth/session-cookie";
import { SESSION_COOKIE } from "@/lib/auth/session-constants";

export { SESSION_COOKIE };

export interface SessionUser {
  /** Passkey user id (users.privy_user_id column — legacy name). */
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

function authMockEnabled(): boolean {
  return process.env.AUTH_MOCK === "true";
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const parsed = parseSessionCookie(cookieStore.get(SESSION_COOKIE)?.value);
  if (parsed) return parsed;
  if (authMockEnabled()) return MOCK_USER;
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
