import "server-only";

import { getSupabase } from "@/lib/supabase/server";
import { normalizeSozuTag } from "@/lib/org-sozu-tag";
import type { Organization } from "@/lib/db/organizations";
import {
  isValidStellarReceiveAddress,
  normalizeStellarAddressInput,
  paymentRailForAddress,
} from "@/lib/payment/stellar-address";
import { resolveOrgTreasuryContractId } from "@/lib/stellar/org-treasury";

export type ResolvedRecipient = {
  walletAddress: string;
  tag: string | null;
  paymentRail: "smart" | "legacy";
  receiveTarget?: "sozupay_org_treasury";
};

function stellarWalletUserColumn(): string {
  return process.env.SOZUPAY_STELLAR_WALLET_USER_ID_COLUMN?.trim() || "user_id";
}

function stellarWalletPublicKeyColumn(): string {
  return process.env.SOZUPAY_STELLAR_WALLET_PUBLIC_KEY_COLUMN?.trim() || "public_key";
}

/**
 * Resolve a Sozu tag ($username) or raw Stellar address to a receive address.
 */
export async function resolvePaymentRecipient(
  rawRecipient: string
): Promise<
  | { ok: true; recipient: ResolvedRecipient }
  | { ok: false; status: number; error: string }
> {
  const trimmed = rawRecipient.trim();
  const direct = normalizeStellarAddressInput(trimmed);

  if (isValidStellarReceiveAddress(direct)) {
    const rail = paymentRailForAddress(direct)!;
    return {
      ok: true,
      recipient: {
        walletAddress: direct,
        tag: null,
        paymentRail: rail,
      },
    };
  }

  const tag = normalizeSozuTag(trimmed);
  if (!tag) {
    return {
      ok: false,
      status: 400,
      error: "Enter a Sozu tag ($username) or a valid Stellar address (G… or C…).",
    };
  }

  const sb = getSupabase();
  const { data: profiles, error: profileError } = await sb
    .from("profiles")
    .select("id, username")
    .ilike("username", tag)
    .not("username", "is", null)
    .limit(10);

  if (profileError) {
    return {
      ok: false,
      status: 404,
      error: "Recipient not found. Check the Sozu tag or wallet address.",
    };
  }

  const profile =
    profiles?.find((p) => p.username === tag) ??
    profiles?.find((p) => p.username?.toLowerCase() === tag) ??
    profiles?.[0] ??
    null;

  if (!profile?.id) {
    return {
      ok: false,
      status: 404,
      error: "Recipient not found. Check the Sozu tag or wallet address.",
    };
  }

  const userCol = stellarWalletUserColumn();
  const pkCol = stellarWalletPublicKeyColumn();

  const [{ data: walletRow, error: walletError }, { data: orgRows }] = await Promise.all([
    sb
      .from("stellar_wallets")
      .select("*")
      .eq(userCol, profile.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from("organizations")
      .select("treasury_contract_id, soroban_contract_id, sozu_tag_auth_user_id")
      .eq("sozu_tag_auth_user_id", profile.id)
      .limit(5),
  ]);

  if (walletError) {
    return {
      ok: false,
      status: 500,
      error: "Failed to look up recipient wallet.",
    };
  }

  let walletAddress: string | null = null;
  let receiveTarget: ResolvedRecipient["receiveTarget"];

  const orgForTag = (orgRows?.[0] as Organization | undefined) ?? null;
  if (orgForTag) {
    const treasuryC = resolveOrgTreasuryContractId(orgForTag);
    if (treasuryC && isValidStellarReceiveAddress(treasuryC)) {
      walletAddress = treasuryC;
      receiveTarget = "sozupay_org_treasury";
    }
  }

  if (!walletAddress) {
    const row = walletRow as Record<string, string> | null;
    const pk = row?.[pkCol]?.trim().toUpperCase() ?? null;
    if (pk && isValidStellarReceiveAddress(pk)) {
      walletAddress = pk;
    }
  }

  if (!walletAddress) {
    return {
      ok: false,
      status: 404,
      error: "Recipient has no wallet yet.",
    };
  }

  const rail = paymentRailForAddress(walletAddress)!;
  return {
    ok: true,
    recipient: {
      walletAddress,
      tag: profile.username ?? tag,
      paymentRail: rail,
      ...(receiveTarget && { receiveTarget }),
    },
  };
}
