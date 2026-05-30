import { createHmac, timingSafeEqual } from "crypto";
import type { SessionUser } from "@/lib/auth/session";

export const SESSION_COOKIE = "sozupay_session";
const SECRET = process.env.AUTH_SECRET ?? "dev-secret-change-in-production";

/** base64url(JSON) + HMAC — avoids dots inside email breaking naive split. */
export function buildSessionCookieValue(user: SessionUser): string {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  const sig = signPayload(payload);
  return `${payload}.${sig}`;
}

function signPayload(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
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

/** Legacy: base64url(JSON + "." + secret) — first-dot split broke @passkey.sozupay emails. */
function parseLegacySessionCookie(raw: string): SessionUser | null {
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf-8");
    const suffix = `.${SECRET}`;
    if (!decoded.endsWith(suffix)) return null;
    const json = decoded.slice(0, -suffix.length);
    return JSON.parse(json) as SessionUser;
  } catch {
    return null;
  }
}

export function parseSessionCookie(raw: string | undefined): SessionUser | null {
  if (!raw) return null;

  const lastDot = raw.lastIndexOf(".");
  if (lastDot > 0) {
    const payload = raw.slice(0, lastDot);
    const sig = raw.slice(lastDot + 1);
    const expected = signPayload(payload);
    try {
      if (
        sig.length === expected.length &&
        timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
      ) {
        const json = Buffer.from(payload, "base64url").toString("utf-8");
        return JSON.parse(json) as SessionUser;
      }
    } catch {
      /* fall through to legacy */
    }
  }

  return parseLegacySessionCookie(raw);
}
