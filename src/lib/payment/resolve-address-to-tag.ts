import "server-only";

import { getSupabase } from "@/lib/supabase/server";
import { normalizeStellarAddressInput } from "@/lib/payment/stellar-address";

function stellarWalletUserColumn(): string {
  return process.env.SOZUPAY_STELLAR_WALLET_USER_ID_COLUMN?.trim() || "user_id";
}

function stellarWalletPublicKeyColumn(): string {
  return process.env.SOZUPAY_STELLAR_WALLET_PUBLIC_KEY_COLUMN?.trim() || "public_key";
}

/** Reverse lookup: Stellar address → Sozu tag ($username), when known. */
export async function resolveAddressToSozuTag(address: string): Promise<string | null> {
  const normalized = normalizeStellarAddressInput(address);
  if (!normalized) return null;

  const sb = getSupabase();
  const pkCol = stellarWalletPublicKeyColumn();
  const userCol = stellarWalletUserColumn();

  const { data: wallet } = await sb
    .from("stellar_wallets")
    .select(userCol)
    .eq(pkCol, normalized)
    .limit(1)
    .maybeSingle();

  const walletUserId = (wallet as Record<string, string> | null)?.[userCol];
  if (walletUserId) {
    const { data: profile } = await sb
      .from("profiles")
      .select("username")
      .eq("id", walletUserId)
      .limit(1)
      .maybeSingle();
    const username = (profile as { username?: string } | null)?.username?.trim();
    if (username) return username;
  }

  const { data: org } = await sb
    .from("organizations")
    .select("sozu_tag_auth_user_id")
    .or(`treasury_contract_id.eq.${normalized},soroban_contract_id.eq.${normalized}`)
    .limit(1)
    .maybeSingle();

  const orgAuthId = (org as { sozu_tag_auth_user_id?: string } | null)?.sozu_tag_auth_user_id;
  if (orgAuthId) {
    const { data: profile } = await sb
      .from("profiles")
      .select("username")
      .eq("id", orgAuthId)
      .limit(1)
      .maybeSingle();
    const username = (profile as { username?: string } | null)?.username?.trim();
    if (username) return username;
  }

  return null;
}

/** Batch reverse lookup for transaction history enrichment. */
export async function resolveAddressesToSozuTags(
  addresses: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(addresses.map(normalizeStellarAddressInput).filter(Boolean))];
  const out = new Map<string, string>();
  await Promise.all(
    unique.map(async (addr) => {
      const tag = await resolveAddressToSozuTag(addr);
      if (tag) out.set(addr, tag);
    })
  );
  return out;
}
