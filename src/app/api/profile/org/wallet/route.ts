import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationForUser, updateOrganizationWallet } from "@/lib/db/organizations";
import { isUserDerivedEncrypted } from "@/lib/org-wallet-encryption";

/**
 * PATCH /api/profile/org/wallet
 * Migration: replace org's stored secret with user-derived encrypted blob (so DB breach does not expose key).
 * Body: { publicKey: string, encryptedSecret: string }
 * - publicKey must match org.stellar_disbursement_public_key.
 * - encryptedSecret must be user-derived format (v1). Replaces current stellar_disbursement_secret_encrypted.
 * Only allowed when current stored value is legacy (server-decryptable). Super_admin only.
 */
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserBySessionId(session.id);
  if (!user || user.admin_level !== "super_admin") {
    return NextResponse.json(
      { error: "Only super admins can update the org wallet." },
      { status: 403 }
    );
  }

  const orgId = user.org_id ?? null;
  if (!orgId) {
    return NextResponse.json(
      { error: "No organization." },
      { status: 400 }
    );
  }

  const org = await getOrganizationForUser(orgId);
  if (!org?.stellar_disbursement_public_key || !org.stellar_disbursement_secret_encrypted) {
    return NextResponse.json(
      { error: "Organization has no wallet to migrate." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const publicKey = typeof body.publicKey === "string" ? body.publicKey.trim() : "";
  const encryptedSecret = typeof body.encryptedSecret === "string" ? body.encryptedSecret.trim() : "";

  if (!publicKey || !encryptedSecret) {
    return NextResponse.json(
      { error: "publicKey and encryptedSecret are required." },
      { status: 400 }
    );
  }

  if (publicKey !== org.stellar_disbursement_public_key) {
    return NextResponse.json(
      { error: "publicKey does not match this organization's disbursement wallet." },
      { status: 400 }
    );
  }

  if (!isUserDerivedEncrypted(encryptedSecret)) {
    return NextResponse.json(
      { error: "encryptedSecret must be user-derived format (v1)." },
      { status: 400 }
    );
  }

  const updated = await updateOrganizationWallet(orgId, publicKey, encryptedSecret);
  if (!updated) {
    return NextResponse.json(
      { error: "Failed to update organization wallet." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
