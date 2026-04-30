import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { setSession } from "@/lib/auth/session";
import { getOrCreateUserByPrivy } from "@/lib/db/users";
import { updateUserStellarPublicKey } from "@/lib/db/users";
import {
  parseInviteCookie,
  SDP_INVITE_COOKIE_NAME,
} from "@/lib/sdp/invitePayload";

/**
 * Sync Turnkey auth to our session.
 * Client sends { subOrganizationId, email?, stellarPublicKey? } after Turnkey login/signup.
 * We treat subOrganizationId as the stable user id (stored in users.privy_user_id for compatibility).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const subOrganizationId =
    typeof body.subOrganizationId === "string" ? body.subOrganizationId.trim() : null;
  const email =
    typeof body.email === "string" && body.email.trim()
      ? body.email.trim()
      : `turnkey-${subOrganizationId?.slice(-8) ?? "unknown"}`;
  const stellarPublicKey =
    typeof body.stellarPublicKey === "string" ? body.stellarPublicKey.trim() : null;

  if (!subOrganizationId) {
    return NextResponse.json(
      { error: "Missing subOrganizationId" },
      { status: 400 }
    );
  }

  let user;
  try {
    user = await getOrCreateUserByPrivy(subOrganizationId, email);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[auth/turnkey] getOrCreateUserByPrivy failed:", message, "subOrgId:", subOrganizationId?.slice(0, 12) + "...", err);
    const isConfig = message.includes("Missing Supabase") || message.includes("env");
    return NextResponse.json(
      {
        error: isConfig
          ? "Server configuration error. Check Supabase env."
          : "Failed to create or load user.",
      },
      { status: isConfig ? 503 : 500 }
    );
  }

  if (stellarPublicKey && stellarPublicKey.startsWith("G") && !user.stellar_public_key) {
    try {
      const updated = await updateUserStellarPublicKey(subOrganizationId, stellarPublicKey);
      if (updated) user = updated;
    } catch {
      // Non-fatal: user exists, we just didn't sync wallet this time
    }
  }

  try {
    await setSession({
      id: user.privy_user_id,
      email: user.email,
      twoFactorEnabled: false,
      orgId: user.org_id ?? undefined,
    });
  } catch (err) {
    console.error("[auth/turnkey] setSession failed:", err instanceof Error ? err.message : err, err);
    return NextResponse.json(
      { error: "Failed to set session." },
      { status: 500 }
    );
  }

  const jar = await cookies();
  const pendingInvite = parseInviteCookie(jar.get(SDP_INVITE_COOKIE_NAME)?.value);
  if (pendingInvite) {
    return NextResponse.json({
      ok: true,
      orgId: user.org_id ?? null,
      redirect: "/sdp/register",
    });
  }

  return NextResponse.json({
    ok: true,
    orgId: user.org_id ?? null,
  });
}
