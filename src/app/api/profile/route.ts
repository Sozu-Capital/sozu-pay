import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { getMemberSmartAccount } from "@/lib/db/smart-accounts";
import { getOrgDisbursementPublicKey } from "@/lib/stellar/sendUsdc";
import { resolveOrgDisbursementContractId } from "@/lib/stellar/org-treasury";
import { isUserDerivedEncrypted } from "@/lib/org-wallet-encryption";
import { canManageDisbursements } from "@/lib/auth/disbursement-auth";

/**
 * GET /api/profile – current user's profile from DB (for Profile page).
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

  const org_payout_wallet_public_key = getOrgDisbursementPublicKey();

  // Read org once — repairOrgCreatorAccess now runs at login, not on every profile load.
  const org = user.org_id ? await getOrganizationForUser(user.org_id) : null;

  const can_manage_disbursements = canManageDisbursements(user, org);

  const orgDisbursementContractId = org ? resolveOrgDisbursementContractId(org) : null;
  const orgHasTreasury =
    !!orgDisbursementContractId || !!(org?.stellar_disbursement_secret_encrypted);

  /** Legacy: classic G payout key setup (deprecated for new orgs). */
  const hasPayoutKey = !!(user.stellar_payout_public_key || user.stellar_public_key);
  const needsPayoutWalletSetup =
    user.admin_level === "super_admin" &&
    !hasPayoutKey &&
    !orgHasTreasury &&
    !orgDisbursementContractId;

  const needsOrgCreation = user.admin_level === "super_admin" && !user.org_id;
  const needsOrganization = !user.org_id;

  const memberSa =
    user.org_id ? await getMemberSmartAccount(user.org_id, user.id) : null;
  const isPollarUser = (user.privy_user_id ?? "").startsWith("pollar:");
  const pollarTreasuryReady =
    isPollarUser && !!(org?.stellar_disbursement_public_key);
  const needsSmartWalletSetup =
    !!user.org_id && memberSa == null && !pollarTreasuryReady;

  const org_stellar_disbursement_public_key = org?.stellar_disbursement_public_key ?? null;
  const org_soroban_contract_id = orgDisbursementContractId;
  const org_has_stored_secret = !!(org?.stellar_disbursement_secret_encrypted);
  const org_encryption_type =
    org?.stellar_disbursement_secret_encrypted && isUserDerivedEncrypted(org.stellar_disbursement_secret_encrypted)
      ? "user_derived"
      : org?.stellar_disbursement_secret_encrypted
        ? "legacy"
        : null;
  const org_has_recovery = !!(org?.recovery_encrypted_secret);

  return NextResponse.json({
    email: user.email,
    username: user.username ?? null,
    org_name: org?.name ?? null,
    stellar_public_key: user.stellar_public_key,
    stellar_payout_public_key: user.stellar_payout_public_key ?? null,
    org_payout_wallet_public_key: org_payout_wallet_public_key ?? null,
    org_id: user.org_id ?? null,
    org_type: org?.type ?? null,
    org_stellar_disbursement_public_key,
    org_soroban_contract_id,
    org_has_stored_secret,
    org_encryption_type,
    org_has_recovery,
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
    treasury_ready: !!orgDisbursementContractId || pollarTreasuryReady,
    is_pollar_user: isPollarUser,
    org_treasury_empty: pollarTreasuryReady,
  });
}
