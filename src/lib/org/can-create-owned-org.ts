/**
 * Operators can always create another Organization.
 * Each org still gets its own treasury G — a Staff Pollar G already bound
 * to an existing org is not reused (see staffGForNewOrg).
 */
export function canCreateOwnedOrg(_accessibleOrgCount: number): boolean {
  return true;
}
