import { cache } from "react";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationForUser, type Organization } from "@/lib/db/organizations";
import { resolveCanonicalActiveOrgId } from "@/lib/db/org-members";
import { resolveOrgDisbursementContractId, resolveOrgTreasuryContractId } from "@/lib/stellar/org-treasury";

export type WalletContext = {
  publicKey: string | null;
  orgId: string | null;
  org: Organization | null;
  disbursementContractId: string | null;
};

/**
 * Request-scoped wallet context. React cache() deduplicates repeated calls
 * within the same RSC or Route Handler render so parallel routes don't
 * re-run the same 2 Supabase round-trips per request.
 */
export const getDashboardWalletContext = cache(async (): Promise<WalletContext> => {
  const session = await getSession();
  if (!session) return { publicKey: null, orgId: null, org: null, disbursementContractId: null };

  const user = await getUserBySessionId(session.id);
  const orgId = user
    ? await resolveCanonicalActiveOrgId({
        userId: user.id,
        primaryOrgId: user.org_id,
        sessionOrgId: session.orgId,
        staffPublicKey: user.stellar_public_key,
      })
    : null;
  if (!orgId) return { publicKey: null, orgId, org: null, disbursementContractId: null };

  const org = await getOrganizationForUser(orgId);
  if (!org) return { publicKey: null, orgId, org: null, disbursementContractId: null };

  const contractId = resolveOrgTreasuryContractId(org);
  const disbursementId = resolveOrgDisbursementContractId(org);
  const publicKey = org.treasury_smart_account_address?.trim() || contractId || org.stellar_disbursement_public_key || null;

  return { publicKey, orgId, org, disbursementContractId: disbursementId };
});
