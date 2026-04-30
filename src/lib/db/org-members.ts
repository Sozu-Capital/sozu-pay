import { getSupabase } from "@/lib/supabase/server";

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

