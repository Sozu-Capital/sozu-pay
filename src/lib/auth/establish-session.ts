import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  buildSessionCookieValue,
  getSessionCookieOptions,
} from "@/lib/auth/session-cookie";
import { SESSION_COOKIE } from "@/lib/auth/session-constants";
import { setSession, type SessionUser } from "@/lib/auth/session";
import type { User } from "@/lib/db/users";

export function sessionUserFromDbUser(user: User): SessionUser {
  return {
    id: String(user.id),
    email: user.email,
    username: user.username ?? undefined,
    twoFactorEnabled: false,
    orgId: user.org_id,
  };
}

export async function establishSessionForUser(user: User): Promise<SessionUser> {
  const sessionUser = sessionUserFromDbUser(user);
  await setSession(sessionUser);
  return sessionUser;
}

/** Attach session cookie to a Route Handler JSON response (required for reliable Set-Cookie). */
export function attachSessionCookie(
  response: NextResponse,
  sessionUser: SessionUser
): NextResponse {
  response.cookies.set(
    SESSION_COOKIE,
    buildSessionCookieValue(sessionUser),
    getSessionCookieOptions()
  );
  return response;
}

export async function jsonResponseWithSession(
  user: User,
  body: Record<string, unknown>,
  init?: ResponseInit
): Promise<NextResponse> {
  const sessionUser = await establishSessionForUser(user);
  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE,
    buildSessionCookieValue(sessionUser),
    getSessionCookieOptions()
  );
  const response = NextResponse.json(body, init);
  return attachSessionCookie(response, sessionUser);
}
