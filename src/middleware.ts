import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const usePrivyAuth = !!PRIVY_APP_ID;

/** When Privy is configured, require session for dashboard. Otherwise use mock in dev. */
const AUTH_MOCK =
  !usePrivyAuth &&
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

  // Legacy /login → home (preserve query string: returnTo, sdpInvite, etc.)
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  const isHome = pathname === "/";
  const isFreshHome = isHome && request.nextUrl.searchParams.get("fresh") === "1";
  const isAuthApi =
    request.nextUrl.pathname.startsWith("/api/auth/verify") ||
    request.nextUrl.pathname.startsWith("/api/auth/send-link") ||
    request.nextUrl.pathname.startsWith("/api/auth/privy");

  if (isAuthApi) return NextResponse.next();

  // Mock auth (no Privy): redirect logged-in users away from home
  if (AUTH_MOCK) {
    if (isHome && session) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Privy: logged-in users skip home unless signing out (?fresh=1)
  if (isHome && session && !isFreshHome) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const isDashboard = pathname.startsWith("/dashboard");
  const isOnboarding = pathname.startsWith("/onboarding");
  const isAuthSuccess = pathname === "/auth/success";
  const isSdpRegister = pathname.startsWith("/sdp/register");

  if ((isDashboard || isOnboarding || isAuthSuccess) && !session) {
    const login = homeUrl(request, {
      returnTo: pathname + request.nextUrl.search,
    });
    return NextResponse.redirect(login);
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
  ],
};
