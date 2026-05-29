import { getSupabase } from "@/lib/supabase/server";

export type OrgType = "store" | "ngo";

export type Organization = {
  id: string;
  name: string;
  type: OrgType;
  stellar_disbursement_public_key: string | null;
  stellar_disbursement_secret_encrypted: string | null;
  recovery_encrypted_secret: string | null;
  soroban_contract_id: string | null;
  treasury_contract_id: string | null;
  treasury_guardian_threshold: number | null;
  treasury_manager_user_id: number | null;
  referral_code: string | null;
  sozu_tag_auth_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function getOrganizationById(
  orgId: string
): Promise<Organization | null> {
  const { data, error } = await getSupabase()
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[organizations] getOrganizationById error:", error.message);
    return null;
  }
  return (data as Organization) ?? null;
}

export async function getOrganizationForUser(
  orgId: string | null
): Promise<Organization | null> {
  if (!orgId) return null;
  return getOrganizationById(orgId);
}

export async function getOrganizationByReferralCode(
  referralCode: string
): Promise<Organization | null> {
  const { data, error } = await getSupabase()
    .from("organizations")
    .select("*")
    .eq("referral_code", referralCode)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[organizations] getOrganizationByReferralCode error:", error.message);
    return null;
  }
  return (data as Organization) ?? null;
}

/** PostgREST: "Could not find the 'col' column ... in the schema cache" */
function parseMissingOrganizationsColumn(message: string): string | null {
  const m = message.match(/Could not find the '([^']+)' column of 'organizations'/i);
  return m?.[1] ?? null;
}

export async function createOrganization(params: {
  name: string;
  type: OrgType;
  stellar_disbursement_public_key?: string | null;
  stellar_disbursement_secret_encrypted?: string | null;
  recovery_encrypted_secret?: string | null;
  sozu_tag_auth_user_id?: string | null;
  treasury_contract_id?: string | null;
  treasury_guardian_threshold?: number | null;
  treasury_manager_user_id?: number | null;
}): Promise<Organization> {
  const payload: Record<string, unknown> = {
    name: params.name,
    type: params.type,
    stellar_disbursement_public_key: params.stellar_disbursement_public_key ?? null,
    stellar_disbursement_secret_encrypted: params.stellar_disbursement_secret_encrypted ?? null,
    recovery_encrypted_secret: params.recovery_encrypted_secret ?? null,
    sozu_tag_auth_user_id: params.sozu_tag_auth_user_id ?? null,
    treasury_contract_id: params.treasury_contract_id ?? null,
    treasury_guardian_threshold: params.treasury_guardian_threshold ?? null,
    treasury_manager_user_id: params.treasury_manager_user_id ?? null,
  };

  const attemptInsert = async (p: Record<string, unknown>) => {
    return await getSupabase()
      .from("organizations")
      .insert(p as never)
      .select()
      .single();
  };

  // Retry while PostgREST reports unknown columns (older DBs / partial migrations).
  let { data, error } = await attemptInsert(payload);
  for (let i = 0; i < 12 && error?.message; i++) {
    const missing = parseMissingOrganizationsColumn(error.message);
    if (!missing || !(missing in payload) || missing === "name" || missing === "type") {
      break;
    }
    console.warn(
      `[organizations] createOrganization: omitting missing column "${missing}" and retrying`
    );
    delete payload[missing];
    ({ data, error } = await attemptInsert(payload));
  }

  if (error) throw new Error(`Failed to create organization: ${error.message}`);
  return data as Organization;
}

export async function updateOrganizationWallet(
  orgId: string,
  publicKey: string,
  secretEncrypted: string
): Promise<Organization | null> {
  const payload: Record<string, unknown> = {
    stellar_disbursement_public_key: publicKey,
    stellar_disbursement_secret_encrypted: secretEncrypted,
    updated_at: new Date().toISOString(),
  };

  const attemptUpdate = async (p: Record<string, unknown>) => {
    return await getSupabase()
      .from("organizations")
      .update(p as never)
      .eq("id", orgId)
      .select()
      .single();
  };

  let { data, error } = await attemptUpdate(payload);
  for (let i = 0; i < 8 && error?.message; i++) {
    const missing = parseMissingOrganizationsColumn(error.message);
    if (!missing || !(missing in payload)) break;
    if (
      missing === "stellar_disbursement_public_key" ||
      missing === "stellar_disbursement_secret_encrypted"
    ) {
      console.error(
        `[organizations] updateOrganizationWallet: required column missing in DB: ${missing}`
      );
      return null;
    }
    console.warn(
      `[organizations] updateOrganizationWallet: omitting missing column "${missing}" and retrying`
    );
    delete payload[missing];
    ({ data, error } = await attemptUpdate(payload));
  }

  if (error) return null;
  return data as Organization;
}

export async function updateOrganizationRecoverySecret(
  orgId: string,
  recoveryEncryptedSecret: string | null
): Promise<Organization | null> {
  const { data, error } = await getSupabase()
    .from("organizations")
    .update({
      recovery_encrypted_secret: recoveryEncryptedSecret,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId)
    .select()
    .single();

  if (!error) return data as Organization;

  // Backwards-compat: allow environments without the column.
  if (
    typeof error.message === "string" &&
    (error.message.includes("recovery_encrypted_secret") ||
      error.message.includes("'recovery_encrypted_secret'"))
  ) {
    const { data: data2, error: error2 } = await getSupabase()
      .from("organizations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", orgId)
      .select()
      .single();
    if (error2) return null;
    return data2 as Organization;
  }

  return null;
}

export async function updateOrganizationSozuTagAuthUserId(
  orgId: string,
  authUserId: string | null
): Promise<Organization | null> {
  const { data, error } = await getSupabase()
    .from("organizations")
    .update({
      sozu_tag_auth_user_id: authUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId)
    .select()
    .single();

  if (error) {
    console.error(
      "[organizations] updateOrganizationSozuTagAuthUserId error:",
      error.message,
      error.code
    );
    return null;
  }
  return data as Organization;
}

export async function updateOrganizationSorobanContract(
  orgId: string,
  sorobanContractId: string
): Promise<Organization | null> {
  const { data, error } = await getSupabase()
    .from("organizations")
    .update({
      soroban_contract_id: sorobanContractId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId)
    .select()
    .single();

  if (error) {
    console.error("[organizations] updateOrganizationSorobanContract:", error.message);
    return null;
  }
  return data as Organization;
}

export async function updateOrganizationTreasuryContract(
  orgId: string,
  treasuryContractId: string
): Promise<Organization | null> {
  const { data, error } = await getSupabase()
    .from("organizations")
    .update({
      treasury_contract_id: treasuryContractId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId)
    .select()
    .single();

  if (error) {
    console.error("[organizations] updateOrganizationTreasuryContract:", error.message);
    return null;
  }
  return data as Organization;
}
