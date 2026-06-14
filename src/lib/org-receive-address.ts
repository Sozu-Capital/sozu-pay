import "server-only";

import type { Organization } from "@/lib/db/organizations";
import { getHorizon } from "@/lib/stellar/server";
import { getUsdcBalance, getUsdcIssuer } from "@/lib/stellar/balance";
import { getSorobanUsdcBalance } from "@/lib/stellar/soroban-balance";
import { resolveOrgTreasuryContractId } from "@/lib/stellar/org-treasury";
import { getSupabase } from "@/lib/supabase/server";

function stellarWalletUserColumn(): string {
  return process.env.SOZUPAY_STELLAR_WALLET_USER_ID_COLUMN?.trim() || "user_id";
}

function stellarWalletPublicKeyColumn(): string {
  return process.env.SOZUPAY_STELLAR_WALLET_PUBLIC_KEY_COLUMN?.trim() || "public_key";
}

/**
 * On-chain address others should use to send USDC to this org.
 * Classic G is preferred for Sozu tag / SEP-style apps; Soroban C is the treasury contract.
 * Treasury smart account address is prioritized for checkout payments.
 */
export function resolveOrgReceiveAddress(org: Organization): {
  classicG: string | null;
  sorobanC: string | null;
  /** Treasury smart account address (C) for checkout payments. */
  treasurySmartAccountAddress: string | null;
  /** Best address for $tag directory + classic USDC payments. */
  tagReceiveAddress: string | null;
  /** Address the dashboard balance API uses. */
  dashboardBalanceAddress: string | null;
} {
  const classicG = org.stellar_disbursement_public_key?.trim() || null;
  const sorobanC = resolveOrgTreasuryContractId(org);
  const treasurySmartAccountAddress = org.treasury_smart_account_address?.trim() || null;
  /** Org $tag → smart account (C) by default; classic G is legacy fallback. */
  const tagReceiveAddress = sorobanC ?? classicG;
  const dashboardBalanceAddress = sorobanC ?? classicG;
  return { classicG, sorobanC, treasurySmartAccountAddress, tagReceiveAddress, dashboardBalanceAddress };
}

/** Same address + balance logic as GET /api/balance (Soroban treasury when configured). */
export async function getOrgTreasuryUsdcBalance(org: Organization): Promise<{
  address: string | null;
  balance: string;
}> {
  const { dashboardBalanceAddress } = resolveOrgReceiveAddress(org);
  if (!dashboardBalanceAddress) {
    return { address: null, balance: "0" };
  }
  const balance = dashboardBalanceAddress.startsWith("C")
    ? await getSorobanUsdcBalance(dashboardBalanceAddress)
    : await getUsdcBalance(dashboardBalanceAddress);
  return { address: dashboardBalanceAddress, balance };
}

export async function getStellarWalletRowForAuthUser(
  authUserId: string
): Promise<{ publicKey: string | null; error?: string }> {
  const userCol = stellarWalletUserColumn();
  const pkCol = stellarWalletPublicKeyColumn();
  const { data, error } = await getSupabase()
    .from("stellar_wallets")
    .select(pkCol)
    .eq(userCol, authUserId)
    .limit(1)
    .maybeSingle();

  if (error) {
    return { publicKey: null, error: error.message };
  }
  const row = data as Record<string, string> | null;
  const publicKey = row?.[pkCol]?.trim() || null;
  return { publicKey };
}

export async function getOrgReceiveDiagnostics(org: Organization): Promise<{
  receive: ReturnType<typeof resolveOrgReceiveAddress>;
  sozuTag: string | null;
  sozuTagAuthUserId: string | null;
  tagDirectoryPublicKey: string | null;
  tagDirectoryError: string | null;
  classicOnNetwork: boolean;
  hasUsdcTrustline: boolean;
  warnings: string[];
}> {
  const receive = resolveOrgReceiveAddress(org);
  const warnings: string[] = [];

  const sozuTagAuthUserId = org.sozu_tag_auth_user_id?.trim() || null;
  let sozuTag: string | null = null;
  if (sozuTagAuthUserId) {
    const { data } = await getSupabase()
      .from("profiles")
      .select("username")
      .eq("id", sozuTagAuthUserId)
      .limit(1)
      .maybeSingle();
    const username = (data as { username?: string } | null)?.username;
    sozuTag = typeof username === "string" && username.trim() ? username : null;
  }

  let tagDirectoryPublicKey: string | null = null;
  let tagDirectoryError: string | null = null;
  if (sozuTagAuthUserId) {
    const row = await getStellarWalletRowForAuthUser(sozuTagAuthUserId);
    tagDirectoryPublicKey = row.publicKey;
    tagDirectoryError = row.error ?? null;
  }

  if (!receive.tagReceiveAddress) {
    warnings.push("no_receive_address");
  }
  if (sozuTag && !tagDirectoryPublicKey) {
    warnings.push("tag_without_stellar_wallets_row");
  }
  if (sozuTag && tagDirectoryPublicKey && receive.tagReceiveAddress && tagDirectoryPublicKey !== receive.tagReceiveAddress) {
    warnings.push("tag_directory_address_mismatch");
  }
  if (receive.sorobanC && !receive.classicG) {
    warnings.push("soroban_only_no_classic_g");
  }
  if (receive.tagReceiveAddress?.startsWith("C")) {
    warnings.push("tag_points_to_soroban_contract");
  }

  let classicOnNetwork = false;
  let hasUsdcTrustline = false;
  const g = receive.classicG;
  if (g) {
    try {
      const account = await getHorizon().loadAccount(g);
      classicOnNetwork = true;
      const issuer = getUsdcIssuer();
      hasUsdcTrustline = account.balances.some(
        (b) =>
          b.asset_type === "credit_alphanum4" &&
          b.asset_code === "USDC" &&
          (b as { asset_issuer?: string }).asset_issuer === issuer
      );
      if (!hasUsdcTrustline) {
        warnings.push("classic_missing_usdc_trustline");
      }
    } catch {
      warnings.push("classic_not_on_network");
    }
  }

  return {
    receive,
    sozuTag,
    sozuTagAuthUserId,
    tagDirectoryPublicKey,
    tagDirectoryError,
    classicOnNetwork,
    hasUsdcTrustline,
    warnings,
  };
}
