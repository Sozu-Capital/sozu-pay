import type { OrgInviteRole } from "@/lib/db/org-invites";
import type { OrgMemberRole } from "@/lib/db/org-members";

export const STAFF_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type StaffInviteValidation =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "EXPIRED" | "ALREADY_USED"; message: string };

export type StaffInviteSnapshot = {
  token: string;
  role: OrgInviteRole;
  expiresAt: string | null;
  acceptedAt: string | null;
};

/** Pure rules for one-time expiring Staff invite tokens (no email match). */
export function validateStaffInvite(
  invite: StaffInviteSnapshot | null,
  now: Date = new Date(),
): StaffInviteValidation {
  if (!invite) {
    return { ok: false, code: "NOT_FOUND", message: "This invite link is invalid or was removed." };
  }
  if (invite.acceptedAt) {
    return { ok: false, code: "ALREADY_USED", message: "This invite link has already been used." };
  }
  if (invite.expiresAt) {
    const exp = new Date(invite.expiresAt).getTime();
    if (Number.isFinite(exp) && exp <= now.getTime()) {
      return { ok: false, code: "EXPIRED", message: "This invite link has expired." };
    }
  }
  return { ok: true };
}

/** Placeholder email so existing NOT NULL + unique(org_id,email) schema works for link invites. */
export function staffInvitePlaceholderEmail(token: string): string {
  const clean = token.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) || "token";
  return `link+${clean}@staff-invite.local`;
}

export function isValidOrgInviteRole(role: unknown): role is OrgInviteRole {
  return (
    role === "member" ||
    role === "admin" ||
    role === "guardian" ||
    role === "treasury_manager"
  );
}

export type UserAdminLevel = "user" | "admin" | "super_admin";

const ADMIN_LEVEL_RANK: Record<UserAdminLevel, number> = {
  user: 0,
  admin: 1,
  super_admin: 2,
};

/** Map invite role → users.admin_level used by existing auth gates. */
export function mapInviteRoleToAdminLevel(
  role: OrgInviteRole,
): "user" | "admin" {
  if (role === "admin" || role === "treasury_manager") return "admin";
  return "user";
}

/** Never demote a creator/admin of another org when they accept a lesser invite. */
export function nextAdminLevelAfterInvite(
  current: UserAdminLevel,
  inviteRole: OrgInviteRole,
): UserAdminLevel {
  const invited = mapInviteRoleToAdminLevel(inviteRole);
  return ADMIN_LEVEL_RANK[invited] > ADMIN_LEVEL_RANK[current] ? invited : current;
}

export function mapInviteRoleToMemberRole(role: OrgInviteRole): OrgMemberRole {
  return role;
}

export function buildStaffInviteUrl(origin: string, token: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/join/${encodeURIComponent(token)}`;
}

/**
 * Host used in the shareable invite URL. Prefer the live request origin so
 * preview/mobile testing isn't stuck on a stale NEXT_PUBLIC_APP_URL (e.g. localhost).
 */
export function staffInviteLinkOrigin(params: {
  requestOrigin: string;
  envAppUrl?: string | null;
}): string {
  const live = params.requestOrigin.replace(/\/$/, "");
  if (live && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(live)) {
    return live;
  }
  const env = (params.envAppUrl ?? "").trim().replace(/\/$/, "");
  return env || live || "http://localhost:3000";
}
