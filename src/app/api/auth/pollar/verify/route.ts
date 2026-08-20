import { NextRequest, NextResponse } from "next/server";
import {
  attachSessionCookie,
  jsonResponseWithSession,
  sessionUserFromDbUser,
} from "@/lib/auth/establish-session";
import { setSession, getSession, type SessionUser } from "@/lib/auth/session";
import { createPollarTokenVerifier } from "@/lib/pollar/adapter";
import { isFakePollarStaffWallet, PollarTokenVerifyError } from "@/lib/pollar/types";
import { getOrCreateUserByPollar, updateUserStellarPublicKey } from "@/lib/db/users";
import { listAccessibleOrgIds } from "@/lib/db/org-members";
import { planPollarLoginDestination } from "@/lib/org/accessible-orgs";


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

    let user = await getOrCreateUserByPollar(identity.subject, identity.email);

    const wallet = (identity.walletAddress ?? "").trim();
    const allowFakeWallet = process.env.POLLAR_FAKE_AUTH === "true";
    if (
      wallet.startsWith("G") &&
      wallet.length >= 56 &&
      user.stellar_public_key !== wallet &&
      (allowFakeWallet || !isFakePollarStaffWallet(wallet))
    ) {
      const updated = await updateUserStellarPublicKey(String(user.id), wallet);
      if (updated) user = updated;
    }

    const orgIds = await listAccessibleOrgIds({
      userId: user.id,
      primaryOrgId: user.org_id,
      staffPublicKey: user.stellar_public_key,
    });
    const previous = await getSession();
    const plan = planPollarLoginDestination({
      orgIds,
      primaryOrgId: user.org_id,
      preservedOrgId: previous?.orgId ?? null,
      returnTo,
    });

    if (plan.sessionOrgId && plan.redirect === "/dashboard") {
      const sessionUser: SessionUser = {
        ...sessionUserFromDbUser(user),
        orgId: plan.sessionOrgId,
      };
      await setSession(sessionUser);
      const response = NextResponse.json({
        success: true,
        userId: user.id,
        redirect: plan.redirect,
      });
      return attachSessionCookie(response, sessionUser);
    }

    return jsonResponseWithSession(user, {
      success: true,
      userId: user.id,
      redirect: plan.redirect,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pollar verify failed";
    console.error("[auth/pollar/verify]", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
