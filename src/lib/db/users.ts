import { getSupabase } from "@/lib/supabase/server";

export type User = {
  id: number;
  privy_user_id: string;
  email: string;
  stellar_public_key: string | null;
  /** Public key of keypair derived from user's payout passphrase (set at onboarding). */
  stellar_payout_public_key: string | null;
  allowed: boolean;
  admin_level: "user" | "admin" | "super_admin";
  org_id: string | null;
  activation_requested_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function getOrCreateUserByPrivy(
  privyUserId: string,
  email: string
): Promise<User> {
  const { data: existing } = await getSupabase()
    .from("users")
    .select("*")
    .eq("privy_user_id", privyUserId)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return existing as User;
  }

  const { data: inserted, error } = await getSupabase()
    .from("users")
    .insert({
      privy_user_id: privyUserId,
      email,
      allowed: false,
      admin_level: "user",
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create user: ${error.message}`);
  return inserted as User;
}

export async function getUserByPrivyId(
  privyUserId: string
): Promise<User | null> {
  const { data } = await getSupabase()
    .from("users")
    .select("*")
    .eq("privy_user_id", privyUserId)
    .limit(1)
    .maybeSingle();

  return (data as User) ?? null;
}

export async function getUserById(id: number): Promise<User | null> {
  const { data } = await getSupabase()
    .from("users")
    .select("*")
    .eq("id", id)
    .limit(1)
    .maybeSingle();

  return (data as User) ?? null;
}

export async function setActivationRequested(privyUserId: string): Promise<User | null> {
  const { data, error } = await getSupabase()
    .from("users")
    .update({ activation_requested_at: new Date().toISOString() })
    .eq("privy_user_id", privyUserId)
    .select()
    .single();

  if (error) return null;
  return data as User;
}

export async function updateUserStellarPublicKey(
  privyUserId: string,
  stellarPublicKey: string
): Promise<User | null> {
  const { data, error } = await getSupabase()
    .from("users")
    .update({ stellar_public_key: stellarPublicKey, updated_at: new Date().toISOString() })
    .eq("privy_user_id", privyUserId)
    .select()
    .single();

  if (error) return null;
  return data as User;
}

export async function getPendingActivationUsers(): Promise<User[]> {
  const { data } = await getSupabase()
    .from("users")
    .select("*")
    .not("activation_requested_at", "is", null)
    .eq("allowed", false)
    .order("activation_requested_at", { ascending: true });
  return (data as User[]) ?? [];
}

export async function setUserAllowed(
  privyUserId: string,
  allowed: boolean
): Promise<User | null> {
  const { data, error } = await getSupabase()
    .from("users")
    .update({ allowed, updated_at: new Date().toISOString() })
    .eq("privy_user_id", privyUserId)
    .select()
    .single();

  if (error) return null;
  return data as User;
}

export async function updateUserPayoutPublicKey(
  privyUserId: string,
  stellarPayoutPublicKey: string
): Promise<{ user: User | null; error: string | null }> {
  const { data, error } = await getSupabase()
    .from("users")
    .update({
      stellar_payout_public_key: stellarPayoutPublicKey,
      updated_at: new Date().toISOString(),
    })
    .eq("privy_user_id", privyUserId)
    .select()
    .single();

  if (error) {
    console.error("[users] updateUserPayoutPublicKey failed:", error.message, error.code);
    return { user: null, error: error.message };
  }
  return { user: data as User, error: null };
}

export async function updateUserOrgId(
  privyUserId: string,
  orgId: string
): Promise<User | null> {
  const { data, error } = await getSupabase()
    .from("users")
    .update({ org_id: orgId, updated_at: new Date().toISOString() })
    .eq("privy_user_id", privyUserId)
    .select()
    .single();

  if (error) return null;
  return data as User;
}

/** Clears org_id (e.g. org row deleted or broken FK). */
export async function clearUserOrgId(privyUserId: string): Promise<User | null> {
  const { data, error } = await getSupabase()
    .from("users")
    .update({ org_id: null, updated_at: new Date().toISOString() })
    .eq("privy_user_id", privyUserId)
    .select()
    .single();

  if (error) return null;
  return data as User;
}
