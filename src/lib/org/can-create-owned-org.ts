/** A User may create at most one owned Organization (one Pollar G = one treasury). */
export function canCreateOwnedOrg(accessibleOrgCount: number): boolean {
  return accessibleOrgCount === 0;
}
