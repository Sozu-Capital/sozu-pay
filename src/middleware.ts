import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const usePrivyAuth = !!PRIVY_APP_ID;

/** When Privy is configured, require session for dashboard. Otherwise use mock in dev. */
const AUTH_MOCK =
  !usePrivyAuth &&
  (process.env.AUTH_MOCK === "true" ||
    (process.env.AUTH_MOCK !== "false" && process.env.NODE_ENV === "development"));

export function middleware(request: NextRequest) {
  const session = request.cookies.get("sozupay_session")?.value;
  const isLogin = request.nextUrl.pathname.startsWith("/login");
  const isHome = request.nextUrl.pathname === "/";
  const isAuthApi =
    request.nextUrl.pathname.startsWith("/api/auth/verify") ||
    request.nextUrl.pathname.startsWith("/api/auth/send-link") ||
    request.nextUrl.pathname.startsWith("/api/auth/privy");

  if (isAuthApi) return NextResponse.next();

  // Mock auth (no Privy): allow all routes; redirect to dashboard if logged in on / or /login
  if (AUTH_MOCK) {
    if ((isLogin || isHome) && session) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Privy: logged-in users shouldn’t see the home gate; /login is special (session clear on that route).
  if (isHome && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Privy auth: protect dashboard and onboarding; do NOT redirect away from /login when session exists
  // so that user always sees login and can choose email (we clear session + Privy on login page)
  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");
  const isOnboarding = request.nextUrl.pathname.startsWith("/onboarding");
  const isAuthSuccess = request.nextUrl.pathname === "/auth/success";
  const isSdpRegister = request.nextUrl.pathname.startsWith("/sdp/register");
  if ((isDashboard || isOnboarding || isAuthSuccess) && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (isSdpRegister && !session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("sdpInvite", "1");
    return NextResponse.redirect(login);
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
    "/sdp/register",
    "/api/auth/verify",
    "/api/auth/send-link",
  ],
};
