import "server-only";
import { randomUUID } from "crypto";
import {
  createOrgInvites,
  getOrgInviteByToken,
  markInviteAccepted,
  type OrgInviteRole,
  type OrgInviteRow,
} from "@/lib/db/org-invites";
import { addOrgMember } from "@/lib/db/org-members";
import { getOrganizationById } from "@/lib/db/organizations";
import {
  updateUserOrgId,
  setUserAllowed,
  type User,
} from "@/lib/db/users";
import {
  STAFF_INVITE_TTL_MS,
  buildStaffInviteUrl,
  isValidOrgInviteRole,
  mapInviteRoleToMemberRole,
  nextAdminLevelAfterInvite,
  staffInvitePlaceholderEmail,
  validateStaffInvite,
} from "@/lib/org/staff-invite";
import { getSupabase } from "@/lib/supabase/server";

export async function createStaffInviteLink(params: {
  orgId: string;
  role: OrgInviteRole;
  origin: string;
  ttlMs?: number;
}): Promise<
  | { ok: true; token: string; url: string; expiresAt: string; role: OrgInviteRole }
  | { ok: false; error: string }
> {
  if (!isValidOrgInviteRole(params.role)) {
    return { ok: false, error: "Invalid role" };
  }
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + (params.ttlMs ?? STAFF_INVITE_TTL_MS)).toISOString();
  const email = staffInvitePlaceholderEmail(token);
  const created = await createOrgInvites({
    orgId: params.orgId,
    invites: [{ email, role: params.role, token, expiresAt }],
  });
  if (!created.ok) {
    return { ok: false, error: created.error ?? "Failed to create invite" };
  }
  return {
    ok: true,
    token,
    url: buildStaffInviteUrl(params.origin, token),
    expiresAt,
    role: params.role,
  };
}

export async function previewStaffInvite(token: string): Promise<
  | {
      ok: true;
      orgId: string;
      orgName: string;
      role: OrgInviteRole;
      expiresAt: string | null;
    }
  | { ok: false; code: string; message: string }
> {
  const invite = await getOrgInviteByToken(token);
  const validation = validateStaffInvite(
    invite
      ? {
          token: invite.token,
          role: invite.role,
          expiresAt: invite.expires_at,
          acceptedAt: invite.accepted_at,
        }
      : null,
  );
  if (!validation.ok) {
    return { ok: false, code: validation.code, message: validation.message };
  }
  const org = await getOrganizationById(invite!.org_id);
  if (!org) {
    return { ok: false, code: "NOT_FOUND", message: "Organization for this invite was not found." };
  }
  return {
    ok: true,
    orgId: org.id,
    orgName: org.name,
    role: invite!.role,
    expiresAt: invite!.expires_at,
  };
}

async function applyInviteRoleToUser(user: User, role: OrgInviteRole): Promise<User> {
  const adminLevel = nextAdminLevelAfterInvite(user.admin_level, role);
  const { data, error } = await getSupabase()
    .from("users")
    .update({
      admin_level: adminLevel,
      allowed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[staff-invite] apply role error:", error.message);
    return user;
  }
  return (data as User) ?? user;
}

/**
 * Accept Staff invite: any Google/Pollar user — no email match against invite row.
 */
export async function acceptStaffInvite(params: {
  token: string;
  user: User;
}): Promise<
  | { ok: true; orgId: string; role: OrgInviteRole; invite: OrgInviteRow }
  | { ok: false; code: string; message: string }
> {
  const invite = await getOrgInviteByToken(params.token);
  const validation = validateStaffInvite(
    invite
      ? {
          token: invite.token,
          role: invite.role,
          expiresAt: invite.expires_at,
          acceptedAt: invite.accepted_at,
        }
      : null,
  );
  if (!validation.ok) {
    return { ok: false, code: validation.code, message: validation.message };
  }

  const member = await addOrgMember(
    params.user.id,
    invite!.org_id,
    mapInviteRoleToMemberRole(invite!.role),
  );
  if (!member.ok) {
    // org_members table may be missing in some envs — still bind primary org_id
    console.warn("[staff-invite] addOrgMember:", member.error);
  }

  if (!params.user.org_id) {
    await updateUserOrgId(params.user.privy_user_id, invite!.org_id);
  } else if (params.user.org_id !== invite!.org_id) {
    // Keep the first org as primary; the invite org is a second membership.
    const previous = await addOrgMember(params.user.id, params.user.org_id, "owner");
    if (!previous.ok) {
      console.warn("[staff-invite] preserve previous org membership:", previous.error);
    }
  }

  let user = await applyInviteRoleToUser(params.user, invite!.role);
  if (invite!.role === "admin" || invite!.role === "treasury_manager") {
    await setUserAllowed(user.privy_user_id, true);
    // re-fetch after allow
    user = (await applyInviteRoleToUser(user, invite!.role)) ?? user;
  }

  const marked = await markInviteAccepted({
    token: params.token,
    acceptedByUserId: params.user.id,
  });
  if (!marked) {
    return { ok: false, code: "ACCEPT_FAILED", message: "Could not mark invite as used." };
  }

  return { ok: true, orgId: invite!.org_id, role: invite!.role, invite: invite! };
}
