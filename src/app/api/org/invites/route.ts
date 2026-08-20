import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAdmin } from "@/lib/auth/disbursement-auth";
import { createStaffInviteLink } from "@/lib/org/accept-staff-invite";
import { isValidOrgInviteRole, staffInviteLinkOrigin } from "@/lib/org/staff-invite";

/**
 * POST /api/org/invites — admin creates a one-time expiring Staff invite link.
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

  const origin = staffInviteLinkOrigin({
    requestOrigin: request.nextUrl.origin,
    envAppUrl: process.env.NEXT_PUBLIC_APP_URL,
  });

  const created = await createStaffInviteLink({
    orgId: auth.user.org_id!,
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
  });
}
