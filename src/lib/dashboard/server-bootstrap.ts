import "server-only";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { getMemberSmartAccount } from "@/lib/db/smart-accounts";
import { getOrgDisbursementPublicKey } from "@/lib/stellar/sendUsdc";
import { resolveOrgDisbursementContractId, resolveOrgTreasuryContractId } from "@/lib/stellar/org-treasury";
import { canManageDisbursements } from "@/lib/auth/disbursement-auth";
import { getUsdcBalance } from "@/lib/stellar/balance";
import { getSorobanUsdcBalance } from "@/lib/stellar/soroban-balance";
import { getUsdToLocalRate, convertUsdToLocal } from "@/lib/fx";
import { getTransactions } from "@/lib/stellar/transactions";
import {
  isOrgDistributionConfigured,
  resolveOrgDistributionPublicKey,
} from "@/lib/sdp/org-distribution";
import type { DashboardProfile, DashboardBalanceData, DashboardStats } from "@/contexts/DashboardProfileContext";
import type { TransactionRow } from "@/lib/stellar/transactions";

export type DashboardBootstrapData = {
  profile: DashboardProfile;
  balance: DashboardBalanceData;
  stats: DashboardStats;
  transactions: TransactionRow[];
};

const EMPTY_BALANCE: DashboardBalanceData = {
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

const EMPTY_STATS: DashboardStats = {
  balanceUsd: "0.00",
  transactionCount: 0,
  apyPercent: 0,
  creditAvailableUsd: "0.00",
  currency: "USD",
};

/**
 * Server-only function that collects the same data as GET /api/dashboard/bootstrap
 * without going through HTTP. Called from the dashboard RSC layout so data is
 * already present when the client hydrates.
 */
export async function getDashboardBootstrapData(): Promise<DashboardBootstrapData | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await getUserBySessionId(session.id);
  if (!user) return null;

  const orgId = user.org_id ?? session.orgId ?? null;
  const org_payout_wallet_public_key = getOrgDisbursementPublicKey();

  const [org, memberSa] = await Promise.all([
    orgId ? getOrganizationForUser(orgId) : Promise.resolve(null),
    orgId ? getMemberSmartAccount(orgId, user.id) : Promise.resolve(null),
  ]);

  const can_manage_disbursements = canManageDisbursements(user, org);
  const orgDisbursementContractId = org ? resolveOrgDisbursementContractId(org) : null;
  const orgTreasuryContractId = org ? resolveOrgTreasuryContractId(org) : null;
  const orgHasTreasury = !!orgDisbursementContractId || !!(org?.stellar_disbursement_secret_encrypted);
  const hasPayoutKey = !!(user.stellar_payout_public_key || user.stellar_public_key);

  const profile: DashboardProfile = {
    email: user.email,
    username: user.username ?? null,
    org_name: org?.name ?? null,
    org_soroban_contract_id: orgDisbursementContractId,
    org_treasury_contract_id: orgTreasuryContractId,
    needsPayoutWalletSetup:
      user.admin_level === "super_admin" && !hasPayoutKey && !orgHasTreasury && !orgDisbursementContractId,
    needsOrgCreation: user.admin_level === "super_admin" && !user.org_id,
    needsOrganization: !user.org_id,
    needsSmartWalletSetup: !!user.org_id && memberSa == null,
    admin_level: user.admin_level,
    can_manage_disbursements,
    member_smart_account_id: memberSa?.contract_id ?? null,
    smart_wallet_ready: !!memberSa,
    org_id: user.org_id ?? null,
    org_type: org?.type ?? null,
  };

  // Dashboard shows treasury balance (receive address). Payout flows use disbursement contract separately.
  const publicKey = orgTreasuryContractId ?? org?.stellar_disbursement_public_key ?? null;

  if (!publicKey) {
    return { profile, balance: EMPTY_BALANCE, stats: EMPTY_STATS, transactions: [] };
  }

  let usdcBalance = "0";
  let distributionUsdc = "0";
  const distributionPk = org ? resolveOrgDistributionPublicKey(org) : null;
  const sdpDistributionConfigured = org ? isOrgDistributionConfigured(org) : false;
  let fx = { rate: 1, currency: "USD", source: "1 USDC = 1 USD" };
  let transactions: Awaited<ReturnType<typeof getTransactions>> = [];
  const disbursementHolder =
    orgDisbursementContractId &&
    orgDisbursementContractId !== publicKey
      ? orgDisbursementContractId
      : null;
  try {
    [usdcBalance, fx, transactions, distributionUsdc] = await Promise.all([
      publicKey.startsWith("C") ? getSorobanUsdcBalance(publicKey) : getUsdcBalance(publicKey),
      getUsdToLocalRate(),
      getTransactions(publicKey, 10, {
        additionalHolders: disbursementHolder ? [disbursementHolder] : undefined,
      }),
      distributionPk ? getUsdcBalance(distributionPk) : Promise.resolve("0"),
    ]);
  } catch (e) {
    console.error("[getDashboardBootstrapData] Stellar fetch failed:", e);
  }

  const balanceNum = parseFloat(usdcBalance) || 0;
  const localFiatAmount = convertUsdToLocal(balanceNum, fx.rate);

  const balance: DashboardBalanceData = {
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

  const stats: DashboardStats = {
    balanceUsd: balanceNum.toFixed(2),
    transactionCount: transactions.length,
    apyPercent: 0,
    creditAvailableUsd: Math.max(0, balanceNum * 0.5).toFixed(2),
    currency: "USD",
  };

  // Exclude org_payout_wallet_public_key from the profile type here (it's an
  // internal field not present in DashboardProfile). The route handler exposes it
  // separately; the context only needs the shape above.
  void org_payout_wallet_public_key;

  return { profile, balance, stats, transactions };
}
