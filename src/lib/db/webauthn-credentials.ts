import { getSupabase } from "@/lib/supabase/server";

export type WebauthnCredentialRow = {
  id: string;
  user_id: number;
  org_id: string | null;
  credential_id: string;
  public_key_65b: string;
  label: string | null;
  created_at: string;
};

export async function addWebauthnCredential(params: {
  userId: number;
  orgId?: string | null;
  credentialId: string;
  publicKey65b: string;
  label?: string | null;
}): Promise<WebauthnCredentialRow | null> {
  const { data, error } = await getSupabase()
    .from("webauthn_credentials")
    .insert({
      user_id: params.userId,
      org_id: params.orgId ?? null,
      credential_id: params.credentialId,
      public_key_65b: params.publicKey65b,
      label: params.label ?? null,
    })
    .select()
    .single();
  if (error) {
    console.error("[webauthn] add credential error:", error.message);
    return null;
  }
  return data as WebauthnCredentialRow;
}

export async function getWebauthnCredentialForUser(params: {
  userId: number;
  credentialId: string;
  orgId?: string | null;
}): Promise<WebauthnCredentialRow | null> {
  let q = getSupabase()
    .from("webauthn_credentials")
    .select("*")
    .eq("user_id", params.userId)
    .eq("credential_id", params.credentialId)
    .limit(1);
  if (params.orgId) {
    q = q.eq("org_id", params.orgId);
  }
  const { data, error } = await q.maybeSingle();
  if (error) return null;
  return (data as WebauthnCredentialRow) ?? null;
}

export async function listWebauthnCredentialsForUser(params: {
  userId: number;
  orgId?: string | null;
}): Promise<WebauthnCredentialRow[]> {
  let q = getSupabase()
    .from("webauthn_credentials")
    .select("*")
    .eq("user_id", params.userId)
    .order("created_at", { ascending: false });
  if (params.orgId) {
    q = q.eq("org_id", params.orgId);
  }
  const { data, error } = await q;
  if (error) return [];
  return (data as WebauthnCredentialRow[]) ?? [];
}

