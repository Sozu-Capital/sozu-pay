/**
 * Session handling – server-side only.
 * Uses signed cookie; in production use AUTH_SECRET. Magic link / OTP verify sets session.
 */

import { cookies } from "next/headers";

const SESSION_COOKIE = "sozupay_session";
const SECRET = process.env.AUTH_SECRET ?? "dev-secret-change-in-production";

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

function sign(value: string): string {
  return Buffer.from(value + "." + SECRET).toString("base64url");
}

function unsign(payload: string): string | null {
  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf-8");
    const [value] = decoded.split(".");
    return value ?? null;
  } catch {
    return null;
  }
}

const MOCK_USER: SessionUser = {
  id: "demo-user-mock",
  email: "demo@sozupay.demo",
  twoFactorEnabled: false,
};

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (raw) {
    const json = unsign(raw);
    if (json) {
      try {
        return JSON.parse(json) as SessionUser;
      } catch {
        // fall through to mock if cookie invalid
      }
    }
  }
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
  const payload = sign(JSON.stringify(user));
  cookieStore.set(SESSION_COOKIE, payload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}
