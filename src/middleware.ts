import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session-constants";

const usePasskeyAuth = true;

/** Demo mode: skip login when AUTH_MOCK=true */
const AUTH_MOCK = process.env.AUTH_MOCK === "true";

/**
 * Best-effort decode of the session cookie payload to extract orgId.
 * Does NOT verify the HMAC signature — that's done in the proper session
 * handler. This is only used for redirect decisions in middleware.
 */
function peekOrgIdFromSessionCookie(raw: string): string | null {
  try {
    const lastDot = raw.lastIndexOf(".");
    const payload = lastDot > 0 ? raw.slice(0, lastDot) : raw;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    const parsed = JSON.parse(json) as { orgId?: unknown };
    return typeof parsed.orgId === "string" ? parsed.orgId : null;
  } catch {
    return null;
  }
}

function homeUrl(request: NextRequest, extra?: Record<string, string>): URL {
  const url = new URL("/", request.url);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  }
  return url;
}

export function middleware(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  const pathname = request.nextUrl.pathname;

  if (pathname === "/merchant" || pathname === "/merchants") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" || pathname.startsWith("/login/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  const isHome = pathname === "/";
  const isFreshHome = isHome && request.nextUrl.searchParams.get("fresh") === "1";
  const returnTo = request.nextUrl.searchParams.get("returnTo");

  const isAuthApi =
    request.nextUrl.pathname.startsWith("/api/auth/verify") ||
    request.nextUrl.pathname.startsWith("/api/auth/send-link") ||
    request.nextUrl.pathname.startsWith("/api/auth/register") ||
    request.nextUrl.pathname.startsWith("/api/auth/login") ||
    request.nextUrl.pathname.startsWith("/api/auth/username") ||
    request.nextUrl.pathname.startsWith("/api/auth/pin") ||
    request.nextUrl.pathname.startsWith("/api/auth/pollar");

  if (isAuthApi) return NextResponse.next();

  if (AUTH_MOCK) {
    if (isHome && session) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (isHome && session && !isFreshHome) {
    if (returnTo && returnTo.startsWith("/")) {
      return NextResponse.redirect(new URL(returnTo, request.url));
    }
    return NextResponse.redirect(new URL("/onboarding/organizations", request.url));
  }

  const isDashboard = pathname.startsWith("/dashboard");
  const isOnboarding = pathname.startsWith("/onboarding");
  const isAuthSuccess = pathname === "/auth/success";
  const isSdpRegister = pathname.startsWith("/sdp/register");

  if ((isDashboard || isOnboarding || isAuthSuccess) && !session) {
    return NextResponse.redirect(
      homeUrl(request, { returnTo: pathname + request.nextUrl.search })
    );
  }

  if (isDashboard && session && usePasskeyAuth && !AUTH_MOCK) {
    const orgId = peekOrgIdFromSessionCookie(session);
    if (!orgId) {
      return NextResponse.redirect(new URL("/onboarding/organizations", request.url));
    }
  }

  if (isSdpRegister && !session) {
    return NextResponse.redirect(homeUrl(request, { sdpInvite: "1" }));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/merchant",
    "/merchants",
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/auth/success",
    "/login",
    "/login/:path*",
    "/sdp/register",
    "/api/auth/verify",
    "/api/auth/send-link",
    "/api/auth/register/:path*",
    "/api/auth/login/:path*",
    "/api/auth/username/:path*",
    "/api/auth/pin/:path*",
    "/api/auth/pollar/:path*",
  ],
};
