import { NextRequest, NextResponse } from "next/server";
import {
  attachSessionCookie,
  jsonResponseWithSession,
  sessionUserFromDbUser,
} from "@/lib/auth/establish-session";
import { setSession, type SessionUser } from "@/lib/auth/session";
import { createPollarTokenVerifier } from "@/lib/pollar/adapter";
import { resolvePollarPostAuthRedirect } from "@/lib/pollar/session-bridge";
import { PollarTokenVerifyError } from "@/lib/pollar/types";
import { getOrCreateUserByPollar } from "@/lib/db/users";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/pollar/verify
 * Body: { token: string; returnTo?: string }
 * Verifies Pollar access token → upserts User (pollar:<subject>) → sozupay_session.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const returnTo = typeof body.returnTo === "string" ? body.returnTo : undefined;

    if (!token) {
      return NextResponse.json({ error: "Missing Pollar token" }, { status: 400 });
    }

    const verifier = createPollarTokenVerifier();
    let identity;
    try {
      identity = await verifier.verify(token);
    } catch (err) {
      if (err instanceof PollarTokenVerifyError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: 401 });
      }
      throw err;
    }

    const user = await getOrCreateUserByPollar(identity.subject, identity.email);
    const redirect = resolvePollarPostAuthRedirect(user, returnTo);

    // Attach orgId to session when resuming a known membership (skip re-onboarding).
    if (user.org_id && redirect === "/dashboard") {
      const sessionUser: SessionUser = {
        ...sessionUserFromDbUser(user),
        orgId: user.org_id,
      };
      await setSession(sessionUser);
      const response = NextResponse.json({
        success: true,
        userId: user.id,
        redirect,
      });
      return attachSessionCookie(response, sessionUser);
    }

    return jsonResponseWithSession(user, {
      success: true,
      userId: user.id,
      redirect,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pollar verify failed";
    console.error("[auth/pollar/verify]", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
