import { getSession } from "@/lib/auth/session";
import { getUserByPrivyId } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { resolveOrgDisbursementContractId } from "@/lib/stellar/org-treasury";

/**
 * Resolve Stellar address for the current user (their wallet). Backend only.
 * Returns null if user has not registered a wallet yet.
 */
export async function getWalletPublicKey(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await getUserByPrivyId(session.id);
  if (!user) return null;

  return user.stellar_public_key ?? null;
}

/**
 * Resolve the address for dashboard balance, tx history, and vault.
 * Prefers org Soroban disbursement contract (C…); falls back to legacy classic G wallet.
 */
export async function getDashboardBalancePublicKey(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await getUserByPrivyId(session.id);
  const orgId = user?.org_id ?? session.orgId ?? null;
  if (!orgId) return null;

  const org = await getOrganizationForUser(orgId);
  if (!org) return null;

  const contractId = resolveOrgDisbursementContractId(org);
  if (contractId) return contractId;

  return org.stellar_disbursement_public_key ?? null;
}
