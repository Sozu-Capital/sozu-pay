import { NextRequest, NextResponse } from "next/server";
import { attachSessionCookie } from "@/lib/auth/establish-session";
import { getSession, setSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationById } from "@/lib/db/organizations";

/**
 * POST /api/auth/set-org – set the current organization for this session.
 * Body: { orgId: string }. User can select their user.org_id or the default org (e.g. Mujeres2000) so everyone can open the dashboard.
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

  const isManager = org.treasury_manager_user_id === user.id;
  const canSelect =
    user.org_id === orgId ||
    user.admin_level === "super_admin" ||
    isManager;

  if (!canSelect) {
    return NextResponse.json({ error: "You do not have access to this organization" }, { status: 403 });
  }

  const nextSession = { ...session, orgId };
  await setSession(nextSession);
  return attachSessionCookie(NextResponse.json({ ok: true, orgId }), nextSession);
}
