/** Org staff whose Pollar G is bound as Home treasury, or who is recorded as treasury manager. */

export type TreasuryOwnerUser = {
  id: number;
  stellar_public_key?: string | null;
};

export type TreasuryOwnerOrg = {
  treasury_manager_user_id?: number | null;
  stellar_disbursement_public_key?: string | null;
};

function classicG(value: string | null | undefined): string | null {
  const g = (value ?? "").trim();
  return g.startsWith("G") && g.length >= 56 ? g : null;
}

export function isTreasuryAdminMemberRole(role: string | null | undefined): boolean {
  return role === "treasury_manager" || role === "owner";
}

/**
 * Who can sign Pollar Home treasury spends.
 * Pollar still signs the session wallet — treasury admin role authorizes the spend,
 * it does not move the Home G onto a different person.
 */
export function isOrgTreasuryOwner(
  user: TreasuryOwnerUser,
  org: TreasuryOwnerOrg | null,
  memberRole?: string | null,
): boolean {
  if (!org) return false;
  if (isTreasuryAdminMemberRole(memberRole)) {
    return true;
  }
  if (org.treasury_manager_user_id != null && org.treasury_manager_user_id === user.id) {
    return true;
  }
  const homeG = classicG(org.stellar_disbursement_public_key);
  const userG = classicG(user.stellar_public_key);
  return homeG != null && userG != null && homeG === userG;
}
