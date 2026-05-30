import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const AUTH_PROVIDER =
  process.env.NEXT_PUBLIC_AUTH_PROVIDER ??
  process.env.AUTH_PROVIDER ??
  (PRIVY_APP_ID ? "privy" : "passkey");

const usePrivyAuth = AUTH_PROVIDER === "privy" && !!PRIVY_APP_ID;
const usePasskeyAuth = AUTH_PROVIDER === "passkey" || !usePrivyAuth;

/** When Privy is configured, require session for dashboard. Otherwise use mock in dev. */
const AUTH_MOCK =
  !usePrivyAuth &&
  !usePasskeyAuth &&
  (process.env.AUTH_MOCK === "true" ||
    (process.env.AUTH_MOCK !== "false" && process.env.NODE_ENV === "development"));

function homeUrl(request: NextRequest, extra?: Record<string, string>): URL {
  const url = new URL("/", request.url);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  }
  return url;
}

export function middleware(request: NextRequest) {
  const session = request.cookies.get("sozupay_session")?.value;
  const pathname = request.nextUrl.pathname;

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
    request.nextUrl.pathname.startsWith("/api/auth/privy") ||
    request.nextUrl.pathname.startsWith("/api/auth/register") ||
    request.nextUrl.pathname.startsWith("/api/auth/login") ||
    request.nextUrl.pathname.startsWith("/api/auth/username") ||
    request.nextUrl.pathname.startsWith("/api/auth/pin");

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
    if (usePasskeyAuth || usePrivyAuth) {
      return NextResponse.redirect(new URL("/onboarding/organizations", request.url));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
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

  if (isSdpRegister && !session) {
    return NextResponse.redirect(homeUrl(request, { sdpInvite: "1" }));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
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
  ],
};
