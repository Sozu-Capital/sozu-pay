import { NextRequest, NextResponse } from "next/server";
import { attachSessionCookie } from "@/lib/auth/establish-session";
import { getSession, setSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationById } from "@/lib/db/organizations";
import { listAccessibleOrgIds } from "@/lib/db/org-members";

/**
 * POST /api/auth/set-org – set the current organization for this session.
 * Body: { orgId: string }. User can select their primary org, org_members
 * membership, or an org they manage as treasury manager.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const orgId = typeof body.orgId === "string" ? body.orgId.trim() : null;
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const user = await getUserBySessionId(session.id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const org = await getOrganizationById(orgId);
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const accessible = await listAccessibleOrgIds({
    userId: user.id,
    primaryOrgId: user.org_id,
    staffPublicKey: user.stellar_public_key,
  });
  const canSelect = accessible.includes(orgId);

  if (!canSelect) {
    return NextResponse.json({ error: "You do not have access to this organization" }, { status: 403 });
  }

  const nextSession = { ...session, orgId };
  await setSession(nextSession);
  return attachSessionCookie(NextResponse.json({ ok: true, orgId }), nextSession);
}
