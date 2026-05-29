import { getSupabase } from "@/lib/supabase/server";

export type WebauthnDbError = {
  message: string;
  code: string;
  details?: string;
};

function mapWebauthnDbError(error: { message: string; code?: string }): WebauthnDbError {
  const msg = error.message ?? "Database error";
  if (
    msg.includes("Could not find the table") ||
    msg.includes("relation") && msg.includes("does not exist")
  ) {
    return {
      message:
        "Passkey tables are missing in Supabase. Run docs/07-reference/supabase-smart-accounts.sql in the SQL Editor, then retry.",
      code: "DB_MIGRATION_REQUIRED",
      details: msg,
    };
  }
  if (error.code === "23505") {
    return {
      message: "This passkey is already registered for your profile.",
      code: "CREDENTIAL_ALREADY_REGISTERED",
      details: msg,
    };
  }
  if (error.code === "23503") {
    return {
      message: "Organization or user record is invalid. Try signing out and back in.",
      code: "FK_VIOLATION",
      details: msg,
    };
  }
  return { message: msg, code: error.code ?? "DB_ERROR", details: msg };
}

export type WebauthnCredentialRow = {
  id: string;
  user_id: number;
  org_id: string | null;
  credential_id: string;
  public_key_65b: string;
  label: string | null;
  created_at: string;
};

export async function upsertWebauthnCredential(params: {
  userId: number;
  orgId?: string | null;
  credentialId: string;
  publicKey65b: string;
  label?: string | null;
}): Promise<{ row: WebauthnCredentialRow | null; error: WebauthnDbError | null }> {
  const payload = {
    user_id: params.userId,
    org_id: params.orgId ?? null,
    credential_id: params.credentialId,
    public_key_65b: params.publicKey65b,
    label: params.label ?? null,
  };

  const { data, error } = await getSupabase()
    .from("webauthn_credentials")
    .upsert(payload, { onConflict: "user_id,credential_id" })
    .select()
    .single();

  if (error) {
    console.error("[webauthn] upsert credential error:", error.message, error.code);
    return { row: null, error: mapWebauthnDbError(error) };
  }
  return { row: data as WebauthnCredentialRow, error: null };
}

/** @deprecated Use upsertWebauthnCredential */
export async function addWebauthnCredential(params: {
  userId: number;
  orgId?: string | null;
  credentialId: string;
  publicKey65b: string;
  label?: string | null;
}): Promise<WebauthnCredentialRow | null> {
  const { row } = await upsertWebauthnCredential(params);
  return row;
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

