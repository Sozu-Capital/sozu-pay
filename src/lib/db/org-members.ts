import { getSupabase } from "@/lib/supabase/server";
import {
  getOrganizationById,
  getOrgIdsByTreasuryPublicKey,
  getOrgIdsManagedByUser,
  type Organization,
} from "@/lib/db/organizations";
import {
  collapseOrgIdsSharingTreasury,
  mergeAccessibleOrgIds,
  pickActiveOrgId,
  remapToCanonicalOrgId,
} from "@/lib/org/accessible-orgs";

export type OrgMemberRole = "member" | "admin" | "owner" | "guardian" | "treasury_manager";

export type OrgMember = {
  id: number;
  user_id: number;
  org_id: string;
  role: OrgMemberRole;
  created_at: string;
};

/**
 * Return org IDs the user is a member of (via org_members table).
 * Does not include user.org_id; caller merges that.
 */
export async function getOrgIdsForUser(userId: number): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId);

  if (error) {
    console.error("[org-members] getOrgIdsForUser error:", error.message);
    return [];
  }
  return (data ?? []).map((r) => r.org_id as string);
}

export async function listAccessibleOrgIds(params: {
  userId: number;
  primaryOrgId?: string | null;
  sessionOrgId?: string | null;
  staffPublicKey?: string | null;
}): Promise<string[]> {
  const [memberOrgIds, managedOrgIds, staffWalletOrgIds] = await Promise.all([
    getOrgIdsForUser(params.userId),
    getOrgIdsManagedByUser(params.userId),
    getOrgIdsByTreasuryPublicKey(params.staffPublicKey),
  ]);
  return mergeAccessibleOrgIds({
    primaryOrgId: params.primaryOrgId,
    sessionOrgId: params.sessionOrgId,
    memberOrgIds,
    managedOrgIds,
    staffWalletOrgIds,
  });
}

/** Memberships + primary + managed + wallet — session cookie is not proof of access. */
export async function resolveActiveOrgId(params: {
  userId: number;
  primaryOrgId?: string | null;
  sessionOrgId?: string | null;
  staffPublicKey?: string | null;
}): Promise<string | null> {
  const accessible = await listAccessibleOrgIds({
    userId: params.userId,
    primaryOrgId: params.primaryOrgId,
    staffPublicKey: params.staffPublicKey,
  });
  return pickActiveOrgId({
    sessionOrgId: params.sessionOrgId,
    primaryOrgId: params.primaryOrgId,
    accessibleOrgIds: accessible,
  });
}

export async function listCollapsedAccessibleOrgs(params: {
  userId: number;
  primaryOrgId?: string | null;
  sessionOrgId?: string | null;
  staffPublicKey?: string | null;
}): Promise<Organization[]> {
  const ids = await listAccessibleOrgIds(params);
  const orgs = (
    await Promise.all(ids.map((id) => getOrganizationById(id)))
  ).filter((org): org is Organization => org != null);
  const kept = new Set(
    collapseOrgIdsSharingTreasury(orgs, [params.primaryOrgId, params.sessionOrgId]),
  );
  return orgs.filter((org) => kept.has(org.id));
}

/** Session org, remapped off ghost clones that share another org's Pollar G. */
export async function resolveCanonicalActiveOrgId(params: {
  userId: number;
  primaryOrgId?: string | null;
  sessionOrgId?: string | null;
  staffPublicKey?: string | null;
}): Promise<string | null> {
  const orgId = await resolveActiveOrgId(params);
  if (!orgId) return null;
  const org = await getOrganizationById(orgId);
  if (!org) return null;
  const siblingIds = await getOrgIdsByTreasuryPublicKey(org.stellar_disbursement_public_key);
  if (siblingIds.length <= 1) return orgId;
  const siblings = (
    await Promise.all(siblingIds.map((id) => getOrganizationById(id)))
  ).filter((row): row is Organization => row != null);
  return remapToCanonicalOrgId(orgId, siblings, [params.primaryOrgId]);
}

export async function getOrgMember(
  userId: number,
  orgId: string,
): Promise<OrgMember | null> {
  const { data, error } = await getSupabase()
    .from("org_members")
    .select("*")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[org-members] getOrgMember error:", error.message);
    return null;
  }
  return (data as OrgMember) ?? null;
}

export async function listOrgMemberRows(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await getSupabase()
    .from("org_members")
    .select("*")
    .eq("org_id", orgId)
    .order("id", { ascending: true });
  if (error) {
    console.error("[org-members] listOrgMemberRows error:", error.message);
    return [];
  }
  return (data ?? []) as OrgMember[];
}

/**
 * Add a user as a member of an org. Idempotent: if already member, no-op.
 */
export async function addOrgMember(
  userId: number,
  orgId: string,
  role: OrgMemberRole = "member"
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await getSupabase()
    .from("org_members")
    .upsert(
      { user_id: userId, org_id: orgId, role },
      { onConflict: "user_id,org_id", ignoreDuplicates: true }
    );

  if (error) {
    console.error("[org-members] addOrgMember error:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Insert or update the member role (invite accept / role admin). */
export async function upsertOrgMember(
  userId: number,
  orgId: string,
  role: OrgMemberRole,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await getSupabase()
    .from("org_members")
    .upsert(
      { user_id: userId, org_id: orgId, role },
      { onConflict: "user_id,org_id" },
    );
  if (error) {
    console.error("[org-members] upsertOrgMember error:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
