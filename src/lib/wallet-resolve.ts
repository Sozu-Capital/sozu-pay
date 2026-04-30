import { getSession } from "@/lib/auth/session";
import { getUserByPrivyId } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";

/**
 * Resolve Stellar address for the current user (their wallet). Backend only.
 * Prefers smart account (C...) when set; otherwise classic public key (G...).
 * Self-custodial: we only store addresses (user registers G); no secret keys.
 * Returns null if user has not registered a wallet yet.
 */
export async function getWalletPublicKey(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await getUserByPrivyId(session.id);
  if (!user) return null;

  return user.stellar_smart_account_address ?? user.stellar_public_key ?? null;
}

/**
 * Resolve the public key for dashboard balance, tx history, and DeFi/vault.
 * This app is organization-centric: the dashboard always shows the organization's
 * disbursement wallet, never the user's personal wallet.
 * Returns null if the user has no org or the org has no disbursement wallet yet.
 */
export async function getDashboardBalancePublicKey(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await getUserByPrivyId(session.id);
  const orgId = user?.org_id ?? session.orgId ?? null;
  if (!orgId) return null;

  const org = await getOrganizationForUser(orgId);
  if (!org?.stellar_disbursement_public_key) return null;

  return org.stellar_disbursement_public_key;
}
