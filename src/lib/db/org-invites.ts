import { getSupabase } from "@/lib/supabase/server";

export type OrgInviteRole = "member" | "admin" | "guardian" | "treasury_manager";

export type OrgInviteRow = {
  id: string;
  org_id: string;
  email: string;
  role: OrgInviteRole;
  token: string;
  expires_at: string | null;
  accepted_at: string | null;
  accepted_by_user_id: number | null;
  created_at: string;
};

export async function createOrgInvites(params: {
  orgId: string;
  invites: Array<{ email: string; role: OrgInviteRole; token: string; expiresAt?: string | null }>;
}): Promise<{ ok: boolean; error?: string }> {
  const rows = params.invites.map((i) => ({
    org_id: params.orgId,
    email: i.email.trim().toLowerCase(),
    role: i.role,
    token: i.token,
    expires_at: i.expiresAt ?? null,
  }));
  const { error } = await getSupabase()
    .from("org_invites")
    .upsert(rows, { onConflict: "org_id,email" });
  if (error) {
    console.error("[org-invites] create error:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function getOrgInviteByToken(
  token: string
): Promise<OrgInviteRow | null> {
  const { data, error } = await getSupabase()
    .from("org_invites")
    .select("*")
    .eq("token", token)
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as OrgInviteRow) ?? null;
}

export async function markInviteAccepted(params: {
  token: string;
  acceptedByUserId: number;
}): Promise<boolean> {
  const { error } = await getSupabase()
    .from("org_invites")
    .update({
      accepted_at: new Date().toISOString(),
      accepted_by_user_id: params.acceptedByUserId,
    })
    .eq("token", params.token);
  return !error;
}

