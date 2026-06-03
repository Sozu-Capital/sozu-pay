import { getSupabase } from "@/lib/supabase/server";
import { normalizeCredentialId } from "@/lib/webauthn/utils";

export type AuthPasskey = {
  id: string;
  user_id: number;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string[] | null;
  created_at: string;
  last_used_at: string | null;
};

export async function insertAuthPasskey(params: {
  userId: number;
  credentialId: string;
  publicKey: string;
  transports?: string[];
}): Promise<AuthPasskey | null> {
  const { data, error } = await getSupabase()
    .from("auth_passkeys")
    .insert({
      user_id: params.userId,
      credential_id: normalizeCredentialId(params.credentialId),
      public_key: params.publicKey,
      counter: 0,
      transports: params.transports ?? [],
    })
    .select()
    .single();

  if (error) {
    console.error("[auth_passkeys] insert:", error.message);
    return null;
  }
  return data as AuthPasskey;
}

export async function findAuthPasskeyByCredentialId(
  credentialId: string
): Promise<AuthPasskey | null> {
  const normalized = normalizeCredentialId(credentialId);
  for (const id of [normalized, credentialId]) {
    const { data } = await getSupabase()
      .from("auth_passkeys")
      .select("*")
      .eq("credential_id", id)
      .maybeSingle();
    if (data) return data as AuthPasskey;
  }
  return null;
}

export async function listAuthPasskeysForUser(userId: number): Promise<AuthPasskey[]> {
  const { data } = await getSupabase()
    .from("auth_passkeys")
    .select("*")
    .eq("user_id", userId)
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  return (data as AuthPasskey[]) ?? [];
}

export async function touchAuthPasskey(id: string): Promise<void> {
  await getSupabase()
    .from("auth_passkeys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", id);
}
