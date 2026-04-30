import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserByPrivyId } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { isUserDerivedEncrypted } from "@/lib/org-wallet-encryption";

/**
 * GET /api/profile/org/encrypted-secret
 * Returns the org's encrypted secret blob (ciphertext only) for client-side decryption with payout password.
 * Only for super_admin of an org that uses user-derived encryption (v1). Legacy orgs must use server unlock flow.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserByPrivyId(session.id);
  if (!user || user.admin_level !== "super_admin") {
    return NextResponse.json(
      { error: "Only super admins can access the encrypted org secret." },
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
  if (!org?.stellar_disbursement_secret_encrypted) {
    return NextResponse.json(
      { error: "Organization has no stored wallet." },
      { status: 404 }
    );
  }

  if (!isUserDerivedEncrypted(org.stellar_disbursement_secret_encrypted)) {
    return NextResponse.json(
      { error: "This organization uses the legacy wallet. Use the unlock wallet flow (passphrase or secret key) instead." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    encryptedSecret: org.stellar_disbursement_secret_encrypted,
  });
}
