import { randomUUID } from "crypto";
import { getSupabase } from "@/lib/supabase/server";

export type User = {
  id: number;
  privy_user_id: string;
  email: string;
  username?: string | null;
  recovery_pin_hash?: string | null;
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

/** Resolve dashboard user from session id (numeric passkey user or legacy Privy id). */
export async function getUserBySessionId(sessionId: string): Promise<User | null> {
  if (/^\d+$/.test(sessionId)) {
    const byId = await getUserById(parseInt(sessionId, 10));
    if (byId) return byId;
  }
  return getUserByPrivyId(sessionId);
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const clean = username.replace(/^\$/, "").trim().toLowerCase();
  const { data } = await getSupabase()
    .from("users")
    .select("*")
    .ilike("username", clean)
    .limit(1)
    .maybeSingle();
  return (data as User) ?? null;
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const existing = await getUserByUsername(username);
  return !existing;
}

export async function createPasskeyUser(username: string): Promise<User> {
  const clean = username.replace(/^\$/, "").trim().toLowerCase();
  const email = `${clean}@passkey.sozupay`;
  const privy_user_id = `passkey:${randomUUID()}`;

  const { data, error } = await getSupabase()
    .from("users")
    .insert({
      privy_user_id,
      email,
      username: clean,
      allowed: false,
      admin_level: "user",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("USERNAME_TAKEN");
    }
    throw new Error(`Failed to create user: ${error.message}`);
  }
  return data as User;
}

export async function setUserRecoveryPinHash(
  userId: number,
  hash: string | null
): Promise<User | null> {
  const { data, error } = await getSupabase()
    .from("users")
    .update({ recovery_pin_hash: hash, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select()
    .single();
  if (error) return null;
  return data as User;
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

async function updateUserBySessionId(
  sessionOrPrivyId: string,
  patch: Record<string, unknown>
): Promise<User | null> {
  const user = await getUserBySessionId(sessionOrPrivyId);
  if (!user) return null;
  const { data, error } = await getSupabase()
    .from("users")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .select()
    .single();
  if (error) return null;
  return data as User;
}

export async function setActivationRequested(sessionOrPrivyId: string): Promise<User | null> {
  return updateUserBySessionId(sessionOrPrivyId, {
    activation_requested_at: new Date().toISOString(),
  });
}

export async function updateUserStellarPublicKey(
  sessionOrPrivyId: string,
  stellarPublicKey: string
): Promise<User | null> {
  return updateUserBySessionId(sessionOrPrivyId, {
    stellar_public_key: stellarPublicKey,
  });
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
  sessionOrPrivyId: string,
  allowed: boolean
): Promise<User | null> {
  const user = await getUserBySessionId(sessionOrPrivyId);
  if (!user) return null;
  const { data, error } = await getSupabase()
    .from("users")
    .update({ allowed, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .select()
    .single();

  if (error) return null;
  return data as User;
}

export async function updateUserPayoutPublicKey(
  sessionOrPrivyId: string,
  stellarPayoutPublicKey: string
): Promise<{ user: User | null; error: string | null }> {
  const user = await updateUserBySessionId(sessionOrPrivyId, {
    stellar_payout_public_key: stellarPayoutPublicKey,
  });
  if (!user) return { user: null, error: "User not found" };
  return { user, error: null };
}

export async function updateUserOrgId(
  sessionOrPrivyId: string,
  orgId: string
): Promise<User | null> {
  return updateUserBySessionId(sessionOrPrivyId, { org_id: orgId });
}

/** Org creator becomes super-admin with dashboard access (no manual activation). */
export async function promoteOrgCreator(
  sessionOrPrivyId: string,
  orgId: string
): Promise<User | null> {
  const user = await updateUserBySessionId(sessionOrPrivyId, {
    org_id: orgId,
    admin_level: "super_admin",
    allowed: true,
  });
  if (!user) {
    console.error("[users] promoteOrgCreator: user not found for session id");
  }
  return user;
}

/** Clears org_id (e.g. org row deleted or broken FK). */
export async function clearUserOrgId(sessionOrPrivyId: string): Promise<User | null> {
  return updateUserBySessionId(sessionOrPrivyId, { org_id: null });
}
