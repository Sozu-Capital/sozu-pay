import type { SessionUser } from "@/lib/auth/session";

export const SESSION_COOKIE = "sozupay_session";
const SECRET = process.env.AUTH_SECRET ?? "dev-secret-change-in-production";

export function buildSessionCookieValue(user: SessionUser): string {
  return Buffer.from(JSON.stringify(user) + "." + SECRET).toString("base64url");
}

export function getSessionCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  maxAge: number;
  path: string;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  };
}

export function parseSessionCookie(raw: string | undefined): SessionUser | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf-8");
    const dot = decoded.indexOf(".");
    if (dot < 0) return null;
    const json = decoded.slice(0, dot);
    const sig = decoded.slice(dot + 1);
    if (sig !== SECRET) return null;
    return JSON.parse(json) as SessionUser;
  } catch {
    return null;
  }
}
