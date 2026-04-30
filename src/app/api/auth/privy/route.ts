import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@privy-io/node";
import { setSession } from "@/lib/auth/session";
import { getOrCreateUserByPrivy } from "@/lib/db/users";
import {
  parseInviteCookie,
  SDP_INVITE_COOKIE_NAME,
} from "@/lib/sdp/invitePayload";

/**
 * Sync Privy auth to our session.
 * Client sends Authorization: Bearer <accessToken> and body { email }.
 * We verify the token and set our session cookie.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return NextResponse.json(
      { error: "Missing Authorization Bearer token" },
      { status: 401 }
    );
  }

  const appId =
    process.env.PRIVY_APP_ID ?? process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const verificationKey = process.env.PRIVY_VERIFICATION_KEY;

  if (!appId || !verificationKey) {
    return NextResponse.json(
      {
        error:
          "Privy not configured. Set PRIVY_APP_ID (or NEXT_PUBLIC_PRIVY_APP_ID) and PRIVY_VERIFICATION_KEY.",
      },
      { status: 503 }
    );
  }

  let claims;
  try {
    claims = await verifyAccessToken({
      access_token: token,
      app_id: appId,
      verification_key: verificationKey,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const email =
    typeof body.email === "string" && body.email.trim()
      ? body.email.trim()
      : `privy-${claims.user_id.slice(-8)}`;

  let user;
  try {
    user = await getOrCreateUserByPrivy(claims.user_id, email);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[auth/privy] getOrCreateUserByPrivy failed:", message, err);
    const isConfig = message.includes("Missing Supabase") || message.includes("env");
    return NextResponse.json(
      { error: isConfig ? "Server configuration error. Check Supabase env." : "Failed to create or load user." },
      { status: isConfig ? 503 : 500 }
    );
  }

  try {
    await setSession({
      id: user.privy_user_id,
      email: user.email,
      twoFactorEnabled: false,
    });
  } catch (err) {
    console.error("[auth/privy] setSession failed:", err instanceof Error ? err.message : err, err);
    return NextResponse.json(
      { error: "Failed to set session." },
      { status: 500 }
    );
  }

  const jar = await cookies();
  const pendingInvite = parseInviteCookie(jar.get(SDP_INVITE_COOKIE_NAME)?.value);
  if (pendingInvite) {
    return NextResponse.json({ ok: true, redirect: "/sdp/register" });
  }

  return NextResponse.json({ ok: true });
}
