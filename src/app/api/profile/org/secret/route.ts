import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationById } from "@/lib/db/organizations";
import { decryptOrgSecret } from "@/lib/org-secret";

/**
 * GET /api/profile/org/secret
 * Returns the decrypted organization disbursement secret for the current user's org.
 * Allowed only for super_admin of that org (creator or any org super_admin can view).
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserBySessionId(session.id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.admin_level !== "super_admin") {
    return NextResponse.json(
      { error: "Only super admins can view the organization wallet secret." },
      { status: 403 }
    );
  }
  if (!user.org_id) {
    return NextResponse.json(
      { error: "You are not in an organization." },
      { status: 400 }
    );
  }

  const org = await getOrganizationById(user.org_id);
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  if (!org.stellar_disbursement_secret_encrypted) {
    return NextResponse.json(
      { error: "Organization wallet secret is not stored." },
      { status: 404 }
    );
  }

  try {
    const secretKey = decryptOrgSecret(org.id, org.stellar_disbursement_secret_encrypted);
    return NextResponse.json({ secretKey });
  } catch {
    return NextResponse.json(
      { error: "Failed to decrypt organization secret." },
      { status: 500 }
    );
  }
}
