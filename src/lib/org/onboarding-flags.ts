/**
 * Dashboard onboarding redirects. Pollar orgs use the Staff/Friendbot treasury,
 * not a passkey smart account — never send those users through create-org or
 * setup-smart-wallet again after the first POST /api/profile/org succeeds.
 */
export function orgOnboardingFlags(params: {
  canonicalOrgId: string | null;
  primaryOrgId: string | null;
  isPollarUser: boolean;
  hasMemberSmartAccount: boolean;
}): {
  needsOrgCreation: boolean;
  needsOrganization: boolean;
  needsSmartWalletSetup: boolean;
} {
  const needsOrganization = !params.canonicalOrgId;
  // Super-admin with users.org_id set already created an org; send them to the
  // picker, not a second create (that re-asks type/name and 409s the $tag).
  const needsOrgCreation = needsOrganization && !params.primaryOrgId;
  const needsSmartWalletSetup =
    !params.isPollarUser && !!params.canonicalOrgId && !params.hasMemberSmartAccount;
  return { needsOrgCreation, needsOrganization, needsSmartWalletSetup };
}

export function matchingOwnedOrg<T extends { id: string; name: string }>(
  orgs: T[],
  name: string,
): T | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  return orgs.find((org) => org.name.trim().toLowerCase() === n) ?? null;
}
