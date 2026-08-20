import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId, getUserById } from "@/lib/db/users";
import { getSupabase } from "@/lib/supabase/server";
import { requireDisbursementAdmin } from "@/lib/auth/disbursement-auth";
import { mapInviteRoleToAdminLevel, mapInviteRoleToMemberRole } from "@/lib/org/staff-invite";
import type { OrgInviteRole } from "@/lib/db/org-invites";
import { isValidOrgInviteRole } from "@/lib/org/staff-invite";
import { getOrgMember, listOrgMemberRows, resolveCanonicalActiveOrgId, upsertOrgMember } from "@/lib/db/org-members";

type MemberRow = {
  id: number;
  email: string;
  role: string;
  admin_level: string;
};

function roleFromAdminLevel(adminLevel: string): string {
  return adminLevel === "super_admin" || adminLevel === "admin" ? "admin" : "member";
}

/**
 * GET /api/org/members — staff of the org currently on the session.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await getUserBySessionId(session.id);
  if (!user) return NextResponse.json({ members: [] });

  const orgId = await resolveCanonicalActiveOrgId({
    userId: user.id,
    primaryOrgId: user.org_id,
    sessionOrgId: session.orgId,
    staffPublicKey: user.stellar_public_key,
  });
  if (!orgId) return NextResponse.json({ members: [] });

  const [memberRows, usersRes] = await Promise.all([
    listOrgMemberRows(orgId),
    getSupabase()
      .from("users")
      .select("id,email,admin_level,allowed")
      .eq("org_id", orgId)
      .order("id", { ascending: true }),
  ]);

  if (usersRes.error) {
    return NextResponse.json({ error: usersRes.error.message }, { status: 500 });
  }

  const byId = new Map<number, MemberRow>();
  for (const row of usersRes.data ?? []) {
    const id = row.id as number;
    byId.set(id, {
      id,
      email: row.email as string,
      role: roleFromAdminLevel(String(row.admin_level ?? "user")),
      admin_level: String(row.admin_level ?? "user"),
    });
  }

  const missingIds = memberRows.map((m) => m.user_id).filter((id) => !byId.has(id));
  if (missingIds.length > 0) {
    const extra = await getSupabase()
      .from("users")
      .select("id,email,admin_level")
      .in("id", missingIds);
    for (const row of extra.data ?? []) {
      const id = row.id as number;
      byId.set(id, {
        id,
        email: row.email as string,
        role: roleFromAdminLevel(String(row.admin_level ?? "user")),
        admin_level: String(row.admin_level ?? "user"),
      });
    }
  }

  for (const m of memberRows) {
    const existing = byId.get(m.user_id);
    if (existing) {
      existing.role = m.role;
    }
  }

  return NextResponse.json({
    orgId,
    members: [...byId.values()].sort((a, b) => a.id - b.id),
  });
}

/**
 * PATCH /api/org/members — { userId, role: OrgInviteRole }
 */
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const auth = await requireDisbursementAdmin(session.id);
  if (!auth.ok) return auth.response;

  const orgId = await resolveCanonicalActiveOrgId({
    userId: auth.user.id,
    primaryOrgId: auth.user.org_id,
    sessionOrgId: session.orgId,
    staffPublicKey: auth.user.stellar_public_key,
  });
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "number" ? body.userId : Number(body.userId);
  const role = body.role;
  if (!Number.isFinite(userId) || !isValidOrgInviteRole(role)) {
    return NextResponse.json({ error: "userId and a valid role are required" }, { status: 400 });
  }

  const [existingMember, targetUser] = await Promise.all([
    getOrgMember(userId, orgId),
    getUserById(userId),
  ]);
  if (!targetUser || (!existingMember && targetUser.org_id !== orgId)) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const memberRole = mapInviteRoleToMemberRole(role as OrgInviteRole);
  const upserted = await upsertOrgMember(userId, orgId, memberRole);
  if (!upserted.ok) {
    return NextResponse.json({ error: upserted.error ?? "Could not update member role" }, { status: 502 });
  }

  const adminLevel = mapInviteRoleToAdminLevel(role as OrgInviteRole);
  const { data, error } = await getSupabase()
    .from("users")
    .update({
      admin_level: adminLevel,
      allowed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("id,email,admin_level")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Member not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, member: { ...data, role: memberRole } });
}
