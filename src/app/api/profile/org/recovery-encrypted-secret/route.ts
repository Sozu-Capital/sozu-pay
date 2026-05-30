import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";

/**
 * GET /api/profile/org/recovery-encrypted-secret
 * Returns the org's recovery ciphertext (encrypted with recovery code) for "forgot payout password" flow.
 * Super_admin only. Client decrypts with recovery code, then user sets new payout password and PATCHes wallet.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserBySessionId(session.id);
  if (!user || user.admin_level !== "super_admin") {
    return NextResponse.json(
      { error: "Only super admins can access recovery data." },
      { status: 403 }
    );
  }

  const orgId = user.org_id ?? null;
  if (!orgId) {
    return NextResponse.json(
      { error: "No organization." },
      { status: 404 }
    );
  }

  const org = await getOrganizationForUser(orgId);
  if (!org?.recovery_encrypted_secret) {
    return NextResponse.json(
      { error: "No recovery ciphertext for this organization." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    recoveryEncryptedSecret: org.recovery_encrypted_secret,
  });
}
