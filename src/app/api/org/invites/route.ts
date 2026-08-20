import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAdmin } from "@/lib/auth/disbursement-auth";
import { createStaffInviteLink } from "@/lib/org/accept-staff-invite";
import { isValidOrgInviteRole, staffInviteLinkOrigin } from "@/lib/org/staff-invite";
import { resolveCanonicalActiveOrgId } from "@/lib/db/org-members";

/**
 * POST /api/org/invites — admin creates a one-time expiring Staff invite link.
 * Bound to the org currently on the session (the one shown in the dashboard),
 * never a stale users.org_id from another tenant.
 * Body: { role: OrgInviteRole }
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await requireDisbursementAdmin(session.id);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const role = body?.role;
  if (!isValidOrgInviteRole(role)) {
    return NextResponse.json(
      { error: "role must be member, admin, guardian, or treasury_manager" },
      { status: 400 },
    );
  }

  const orgId = await resolveCanonicalActiveOrgId({
    userId: auth.user.id,
    primaryOrgId: auth.user.org_id,
    sessionOrgId: session.orgId,
    staffPublicKey: auth.user.stellar_public_key,
  });
  if (!orgId) {
    return NextResponse.json(
      {
        error: "No organization selected, or you do not have access to the current organization.",
        code: "ORG_MISMATCH",
      },
      { status: 400 },
    );
  }

  const origin = staffInviteLinkOrigin({
    requestOrigin: request.nextUrl.origin,
    envAppUrl: process.env.NEXT_PUBLIC_APP_URL,
  });

  const created = await createStaffInviteLink({
    orgId,
    role,
    origin,
  });

  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: 502 });
  }

  return NextResponse.json({
    token: created.token,
    url: created.url,
    expiresAt: created.expiresAt,
    role: created.role,
    orgId: created.orgId,
    orgName: created.orgName,
    shareText: created.shareText,
  });
}
