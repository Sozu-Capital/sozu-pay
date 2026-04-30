import { NextResponse } from "next/server";
import { getSession, setSession } from "@/lib/auth/session";
import { getUserByPrivyId, getOrCreateUserByPrivy } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { getMemberSmartAccount } from "@/lib/db/smart-accounts";
import { getOrgDisbursementPublicKey } from "@/lib/stellar/sendUsdc";
import { isUserDerivedEncrypted } from "@/lib/org-wallet-encryption";

/**
 * GET /api/profile – current user's profile from DB (for Profile page).
 * Creates the user if they have a session but no row yet (e.g. first visit after login).
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let user = await getUserByPrivyId(session.id);
  if (!user) {
    try {
      user = await getOrCreateUserByPrivy(session.id, session.email ?? "");
    } catch {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
  }

  /** Org disbursement wallet from env (optional). When set, Classic payouts can use it; else super_admin signs with their own key. */
  const org_payout_wallet_public_key = getOrgDisbursementPublicKey();

  /** Super-admin needs a way to sign payouts: either org disbursement wallet (stored) or their own admin key. */
  const hasPayoutKey = !!(user.stellar_payout_public_key || user.stellar_public_key);
  const org = user.org_id ? await getOrganizationForUser(user.org_id) : null;
  const orgHasDisbursementWallet = !!(org?.stellar_disbursement_secret_encrypted);
  const needsPayoutWalletSetup =
    user.admin_level === "super_admin" && !hasPayoutKey && !orgHasDisbursementWallet;

  /** Super-admin with no org must create one first (Store or NGO). */
  const needsOrgCreation =
    user.admin_level === "super_admin" && !user.org_id;

  /** Any user without an org must go through organization step (create or get added). */
  const needsOrganization = !user.org_id;

  const needsSmartWalletSetup =
    !!user.org_id && !!user.allowed && (await getMemberSmartAccount(user.org_id, user.id)) == null;

  const org_stellar_disbursement_public_key = org?.stellar_disbursement_public_key ?? null;
  const org_has_stored_secret = !!(org?.stellar_disbursement_secret_encrypted);
  const org_encryption_type =
    org?.stellar_disbursement_secret_encrypted && isUserDerivedEncrypted(org.stellar_disbursement_secret_encrypted)
      ? "user_derived"
      : org?.stellar_disbursement_secret_encrypted
        ? "legacy"
        : null;
  const org_has_recovery = !!(org?.recovery_encrypted_secret);

  // If user has an org but session has no orgId (e.g. old session), set it so dashboard works
  if (user.org_id && session.orgId !== user.org_id) {
    try {
      await setSession({ ...session, orgId: user.org_id });
    } catch {
      // non-fatal: continue and return profile
    }
  }

  return NextResponse.json({
    email: user.email,
    stellar_public_key: user.stellar_public_key,
    stellar_payout_public_key: user.stellar_payout_public_key ?? null,
    org_payout_wallet_public_key: org_payout_wallet_public_key ?? null,
    org_id: user.org_id ?? null,
    org_type: org?.type ?? null,
    org_stellar_disbursement_public_key,
    org_has_stored_secret,
    org_encryption_type,
    org_has_recovery,
    allowed: user.allowed,
    admin_level: user.admin_level,
    activation_requested_at: user.activation_requested_at,
    needsPayoutWalletSetup,
    needsOrgCreation,
    needsOrganization,
    needsSmartWalletSetup,
  });
}
