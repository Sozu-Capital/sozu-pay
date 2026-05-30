import "server-only";

import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/server";
import {
  getOrganizationById,
  updateOrganizationSozuTagAuthUserId,
  type Organization,
} from "@/lib/db/organizations";
import { resolveOrgReceiveAddress } from "@/lib/org-receive-address";

function stellarWalletUserColumn(): string {
  return process.env.SOZUPAY_STELLAR_WALLET_USER_ID_COLUMN?.trim() || "user_id";
}

function stellarWalletPublicKeyColumn(): string {
  return process.env.SOZUPAY_STELLAR_WALLET_PUBLIC_KEY_COLUMN?.trim() || "public_key";
}

/**
 * Normalize a Sozu tag: strip leading $, lowercase, allow [a-z0-9_], length 3–30.
 */
export function normalizeSozuTag(raw: string): string | null {
  const s = raw.trim().replace(/^\$+/, "").toLowerCase();
  if (s.length < 3 || s.length > 30) return null;
  if (!/^[a-z0-9_]+$/.test(s)) return null;
  return s;
}

async function lookupUsernameOwnerId(
  sb: SupabaseClient,
  username: string
): Promise<string | null> {
  const { data, error } = await sb
    .from("profiles")
    .select("id")
    .eq("username", username)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[org-sozu-tag] profiles username lookup:", error.message);
    return null;
  }
  return (data as { id?: string } | null)?.id ?? null;
}

async function setProfileUsername(
  sb: SupabaseClient,
  authUserId: string,
  username: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Try update first (profile row may exist via trigger)
  const { data: updated, error: updateError } = await sb
    .from("profiles")
    .update({ username })
    .eq("id", authUserId)
    .select("id")
    .maybeSingle();

  if (!updateError && (updated as { id?: string } | null)?.id) {
    return { ok: true };
  }

  // Fall back to insert. This assumes your profiles table only requires id + username.
  // If your schema requires more columns, adjust this insert or add a trigger in Supabase.
  const { error: insertError } = await sb.from("profiles").insert({ id: authUserId, username });
  if (insertError) {
    const msg =
      updateError?.message ||
      insertError.message ||
      "Could not write profiles.username (check RLS, NOT NULL columns, or triggers).";
    return { ok: false, error: msg };
  }
  return { ok: true };
}

async function upsertStellarWallet(
  sb: SupabaseClient,
  authUserId: string,
  publicKey: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userCol = stellarWalletUserColumn();
  const pkCol = stellarWalletPublicKeyColumn();

  // Build row; include turnkey_wallet_id as a fallback value when the column
  // is NOT NULL but Turnkey is not in use. Use authUserId as a stable unique
  // placeholder. Ideal fix: run ALTER TABLE stellar_wallets ALTER COLUMN
  // turnkey_wallet_id DROP NOT NULL; in Supabase.
  const row: Record<string, string> = {
    [userCol]: authUserId,
    [pkCol]: publicKey,
    turnkey_wallet_id: authUserId,
  };

  const { error } = await sb.from("stellar_wallets").upsert(row, { onConflict: userCol });
  if (!error) return { ok: true };

  return {
    ok: false,
    error: `stellar_wallets upsert failed (${userCol}, ${pkCol}): ${error.message}. If your schema differs, set SOZUPAY_STELLAR_WALLET_USER_ID_COLUMN / SOZUPAY_STELLAR_WALLET_PUBLIC_KEY_COLUMN.`,
  };
}

function orgSyntheticEmail(orgId: string): string {
  return `org+${orgId.replace(/-/g, "")}@sozupay-org.internal`;
}

export async function applyOrganizationSozuTag(params: {
  orgId: string;
  usernameRaw: string;
}): Promise<
  | { ok: true; username: string; sozuTagAuthUserId: string }
  | { ok: false; status: number; error: string }
> {
  const username = normalizeSozuTag(params.usernameRaw);
  if (!username) {
    return {
      ok: false,
      status: 400,
      error: "Invalid tag. Use 3–30 characters: letters, digits, underscore; optional leading $.",
    };
  }

  const org = await getOrganizationById(params.orgId);
  if (!org) return { ok: false, status: 404, error: "Organization not found." };

  const { tagReceiveAddress: destination } = resolveOrgReceiveAddress(org);
  if (!destination) {
    return {
      ok: false,
      status: 422,
      error:
        "Organization has no receive address yet. Provision treasury (Soroban) or a classic G wallet on Profile first.",
    };
  }

  const sb = getSupabase();
  const existingOwnerId = await lookupUsernameOwnerId(sb, username);
  const currentAuthId = org.sozu_tag_auth_user_id?.trim() || null;
  if (existingOwnerId && existingOwnerId !== currentAuthId) {
    return { ok: false, status: 409, error: "That tag is already taken." };
  }

  let authUserId = currentAuthId;
  if (!authUserId) {
    const password = randomBytes(24).toString("base64url");
    const { data, error } = await sb.auth.admin.createUser({
      email: orgSyntheticEmail(org.id),
      password,
      email_confirm: true,
      app_metadata: { sozupay_org_id: org.id, kind: "org_tag_user" },
    });
    const createdId = data?.user?.id ?? null;
    if (error || !createdId) {
      console.error("[org-sozu-tag] auth.admin.createUser:", error?.message);
      return {
        ok: false,
        status: 502,
        error: error?.message ?? "Failed to create synthetic auth user for org tag.",
      };
    }
    authUserId = createdId;

    const linked = await updateOrganizationSozuTagAuthUserId(org.id, authUserId);
    if (!linked) {
      await sb.auth.admin.deleteUser(authUserId);
      return {
        ok: false,
        status: 500,
        error:
          "Failed to link organization to tag user. Ensure Supabase has the column `organizations.sozu_tag_auth_user_id` (run docs/07-reference/supabase-org-sozu-tag.sql).",
      };
    }
  }

  const p = await setProfileUsername(sb, authUserId, username);
  if (!p.ok) return { ok: false, status: 502, error: p.error };

  const w = await upsertStellarWallet(sb, authUserId, destination);
  if (!w.ok) return { ok: false, status: 502, error: w.error };

  return { ok: true, username, sozuTagAuthUserId: authUserId };
}

export async function getOrganizationSozuTag(org: Organization): Promise<string | null> {
  const uid = org.sozu_tag_auth_user_id?.trim() || null;
  if (!uid) return null;
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("username")
    .eq("id", uid)
    .limit(1)
    .maybeSingle();
  if (error) return null;
  const username = (data as { username?: string } | null)?.username;
  return typeof username === "string" && username.trim() ? username : null;
}

