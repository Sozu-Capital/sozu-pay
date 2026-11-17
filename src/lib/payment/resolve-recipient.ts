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
import { selectCanonicalSmartAccount, pickTagOwner } from "@/lib/payment/canonical-smart-account";

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

  const matches = (profiles ?? []).filter(
    (p) => p.username && p.username.toLowerCase() === tag,
  );
  if (matches.length === 0) {
    return {
      ok: false,
      status: 404,
      error: "Recipient not found. Check the Sozu tag or wallet address.",
    };
  }

  const userCol = stellarWalletUserColumn();
  const pkCol = stellarWalletPublicKeyColumn();
  const matchIds = matches.map((p) => p.id);

  const [{ data: walletRows, error: walletError }, { data: orgRows }] = await Promise.all([
    sb
      .from("stellar_wallets")
      .select("*")
      .in(userCol, matchIds),
    sb
      .from("organizations")
      .select("treasury_contract_id, soroban_contract_id, sozu_tag_auth_user_id")
      .in("sozu_tag_auth_user_id", matchIds)
      .limit(5),
  ]);

  if (walletError) {
    return {
      ok: false,
      status: 500,
      error: "Failed to look up recipient wallet.",
    };
  }

  const wallets = (walletRows ?? []) as Array<Record<string, string>>;
  const createdAtFor = (userId: string): string | null => {
    const row = wallets.find((wallet) => wallet[userCol] === userId);
    return row?.created_at ?? row?.updated_at ?? null;
  };
  const profile = pickTagOwner(
    matches.map((p) => ({
      id: p.id,
      username: p.username,
      walletCreatedAt: createdAtFor(p.id),
    })),
  );

  if (!profile?.id) {
    return {
      ok: false,
      status: 404,
      error: "Recipient not found. Check the Sozu tag or wallet address.",
    };
  }

  const walletRow = wallets.find((wallet) => wallet[userCol] === profile.id) ?? null;
  const orgForUser = (orgRows ?? []).filter(
    (org) => (org as { sozu_tag_auth_user_id?: string }).sozu_tag_auth_user_id === profile.id,
  );

  let walletAddress: string | null = null;
  let receiveTarget: ResolvedRecipient["receiveTarget"];

  const orgForTag = (orgForUser[0] as Organization | undefined) ?? null;
  const row = walletRow as Record<string, string> | null;
  const pk = row?.[pkCol]?.trim().toUpperCase() ?? null;
  const treasuryC = orgForTag ? resolveOrgTreasuryContractId(orgForTag) : null;
  const canonical = selectCanonicalSmartAccount({
    walletPublicKey: pk,
    orgTreasuryContractId: treasuryC,
  });
  if (canonical) {
    walletAddress = canonical.contractId;
    if (canonical.source === "org_treasury") receiveTarget = "sozupay_org_treasury";
  } else if (pk && isValidStellarReceiveAddress(pk)) {
    walletAddress = pk;
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
