import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { getMemberSmartAccount } from "@/lib/db/smart-accounts";
import { getOrgDisbursementPublicKey } from "@/lib/stellar/sendUsdc";
import { resolveOrgDisbursementContractId, resolveOrgTreasuryContractId } from "@/lib/stellar/org-treasury";
import { isUserDerivedEncrypted } from "@/lib/org-wallet-encryption";
import { canManageDisbursements, isOrgTreasuryOwner } from "@/lib/auth/disbursement-auth";
import { isPollarMappedUser } from "@/lib/pollar/session-bridge";
import { getUsdcBalance } from "@/lib/stellar/balance";
import { getSorobanUsdcBalance } from "@/lib/stellar/soroban-balance";
import { getUsdToLocalRate, convertUsdToLocal } from "@/lib/fx";
import { getTransactions } from "@/lib/stellar/transactions";
import {
  isOrgDistributionConfigured,
  resolveOrgDistributionPublicKey,
} from "@/lib/sdp/org-distribution";

/**
 * GET /api/dashboard/bootstrap
 *
 * Single endpoint for the dashboard's initial data load. Runs DB lookups once
 * and fires all Stellar/FX work in parallel so the client makes one request
 * instead of the previous four (profile + balance + stats + transactions).
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserBySessionId(session.id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const orgId = session.orgId ?? null;
  const org_payout_wallet_public_key = getOrgDisbursementPublicKey();

  // Load org and smart account in parallel — only 2 DB calls total.
  const [org, memberSa] = await Promise.all([
    orgId ? getOrganizationForUser(orgId) : Promise.resolve(null),
    orgId ? getMemberSmartAccount(orgId, user.id) : Promise.resolve(null),
  ]);

  // --- Profile fields ---
  const can_manage_disbursements = canManageDisbursements(user, org);
  const orgDisbursementContractId = org ? resolveOrgDisbursementContractId(org) : null;
  const orgTreasuryContractId = org ? resolveOrgTreasuryContractId(org) : null;
  const orgHasTreasury = !!orgDisbursementContractId || !!(org?.stellar_disbursement_secret_encrypted);
  const hasPayoutKey = !!(user.stellar_payout_public_key || user.stellar_public_key);

  const needsPayoutWalletSetup =
    user.admin_level === "super_admin" && !hasPayoutKey && !orgHasTreasury && !orgDisbursementContractId;
  const needsOrgCreation = user.admin_level === "super_admin" && !user.org_id;
  const needsOrganization = !user.org_id;
  const needsSmartWalletSetup =
    !!user.org_id &&
    memberSa == null &&
    !(isPollarMappedUser(user) && org?.stellar_disbursement_public_key);

  const profile = {
    email: user.email,
    username: user.username ?? null,
    org_name: org?.name ?? null,
    stellar_public_key: user.stellar_public_key,
    stellar_payout_public_key: user.stellar_payout_public_key ?? null,
    org_payout_wallet_public_key: org_payout_wallet_public_key ?? null,
    org_id: user.org_id ?? null,
    org_type: org?.type ?? null,
    org_stellar_disbursement_public_key: org?.stellar_disbursement_public_key ?? null,
    org_soroban_contract_id: orgDisbursementContractId,
    org_treasury_contract_id: orgTreasuryContractId,
    org_has_stored_secret: !!(org?.stellar_disbursement_secret_encrypted),
    org_encryption_type:
      org?.stellar_disbursement_secret_encrypted && isUserDerivedEncrypted(org.stellar_disbursement_secret_encrypted)
        ? "user_derived"
        : org?.stellar_disbursement_secret_encrypted
          ? "legacy"
          : null,
    org_has_recovery: !!(org?.recovery_encrypted_secret),
    allowed: user.allowed,
    admin_level: user.admin_level,
    can_manage_disbursements,
    member_smart_account_id: memberSa?.contract_id ?? null,
    smart_wallet_ready: !!memberSa,
    activation_requested_at: user.activation_requested_at,
    needsPayoutWalletSetup,
    needsOrgCreation,
    needsOrganization,
    needsSmartWalletSetup,
    treasury_ready: !!orgDisbursementContractId,
    is_pollar_user: isPollarMappedUser(user),
    is_treasury_owner: isOrgTreasuryOwner(user, org),
  };

  // --- Stellar + FX data (parallel, org wallet only) ---
  // Dashboard shows treasury balance (receive address). Payout flows use disbursement contract separately.
  const publicKey = org?.treasury_smart_account_address?.trim() || orgTreasuryContractId || org?.stellar_disbursement_public_key || null;

  if (!publicKey) {
    // No wallet configured yet — return zeros so the dashboard still renders.
    const emptyBalance = {
      usdc: "0",
      available: "0",
      inVault: "0",
      fiatAmount: "0.00",
      fiatCurrency: "USD",
      localFiatAmount: "0.00",
      localFiatCurrency: "USD",
      rateSource: "1 USDC = 1 USD",
      distributionUsdc: "0",
      sdpDistributionConfigured: false,
    };
    return NextResponse.json({
      profile,
      balance: emptyBalance,
      stats: { balanceUsd: "0.00", transactionCount: 0, apyPercent: 0, creditAvailableUsd: "0.00", currency: "USD" },
      transactions: [],
    });
  }

  // Fetch balance, FX, and recent transactions — profile must still load if Stellar fails.
  let usdcBalance = "0";
  let distributionUsdc = "0";
  const distributionPk = org ? resolveOrgDistributionPublicKey(org) : null;
  const sdpDistributionConfigured = org ? isOrgDistributionConfigured(org) : false;
  let fx = { rate: 1, currency: "USD", source: "1 USDC = 1 USD" };
  let transactions: Awaited<ReturnType<typeof getTransactions>> = [];
  
  // Collect all potential holders for transaction fetching to ensure no transfers are missed
  const additionalHoldersList: string[] = [];
  if (org?.stellar_disbursement_public_key) {
    additionalHoldersList.push(org.stellar_disbursement_public_key);
  }
  if (orgDisbursementContractId) {
    additionalHoldersList.push(orgDisbursementContractId);
  }
  if (orgTreasuryContractId) {
    additionalHoldersList.push(orgTreasuryContractId);
  }
  if (org?.treasury_smart_account_address) {
    additionalHoldersList.push(org.treasury_smart_account_address);
  }
  const uniqueHolders = Array.from(new Set(additionalHoldersList))
    .filter((h) => h !== publicKey);

  try {
    [usdcBalance, fx, transactions, distributionUsdc] = await Promise.all([
      publicKey.startsWith("C") ? getSorobanUsdcBalance(publicKey) : getUsdcBalance(publicKey),
      getUsdToLocalRate(),
      getTransactions(publicKey, 10, {
        additionalHolders: uniqueHolders,
      }),
      distributionPk ? getUsdcBalance(distributionPk) : Promise.resolve("0"),
    ]);
  } catch (e) {
    console.error("[api/dashboard/bootstrap] Stellar fetch failed:", e);
  }

  const balanceNum = parseFloat(usdcBalance) || 0;
  const localFiatAmount = convertUsdToLocal(balanceNum, fx.rate);

  const balance = {
    usdc: usdcBalance,
    available: usdcBalance,
    inVault: "0",
    fiatAmount: balanceNum.toFixed(2),
    fiatCurrency: "USD",
    rateSource: fx.source,
    localFiatAmount,
    localFiatCurrency: fx.currency,
    distributionUsdc,
    sdpDistributionConfigured,
  };

  const stats = {
    balanceUsd: balanceNum.toFixed(2),
    transactionCount: transactions.length,
    apyPercent: 0,
    creditAvailableUsd: Math.max(0, balanceNum * 0.5).toFixed(2),
    currency: "USD",
  };

  return NextResponse.json({ profile, balance, stats, transactions });
}
