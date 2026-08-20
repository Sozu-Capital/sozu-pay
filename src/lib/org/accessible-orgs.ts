/** Merge every org a user can open: primary row, session, memberships, treasury-manager. */
export function mergeAccessibleOrgIds(parts: {
  primaryOrgId?: string | null;
  sessionOrgId?: string | null;
  memberOrgIds?: string[];
  managedOrgIds?: string[];
}): string[] {
  return [
    ...new Set(
      [
        parts.primaryOrgId,
        parts.sessionOrgId,
        ...(parts.memberOrgIds ?? []),
        ...(parts.managedOrgIds ?? []),
      ].filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
}

export function planPollarLoginDestination(params: {
  orgIds: string[];
  primaryOrgId: string | null;
  preservedOrgId: string | null;
  returnTo?: string;
}): { redirect: string; sessionOrgId: string | null } {
  const orgIds = [...new Set(params.orgIds.filter(Boolean))];
  const preserved =
    params.preservedOrgId && orgIds.includes(params.preservedOrgId)
      ? params.preservedOrgId
      : null;
  const returnTo =
    params.returnTo && params.returnTo.startsWith("/") && !params.returnTo.startsWith("//")
      ? params.returnTo
      : undefined;

  if (returnTo) {
    const sessionOrgId = orgIds.length === 1 ? orgIds[0]! : preserved;
    return { redirect: returnTo, sessionOrgId: sessionOrgId ?? null };
  }

  // One Gmail/Pollar identity in two orgs must pick — never silently resume the last one.
  if (orgIds.length > 1) {
    return { redirect: "/onboarding/organizations", sessionOrgId: null };
  }

  if (orgIds.length === 1) {
    return { redirect: "/dashboard", sessionOrgId: preserved ?? orgIds[0]! };
  }

  if (params.primaryOrgId) {
    return { redirect: "/dashboard", sessionOrgId: params.primaryOrgId };
  }

  return { redirect: "/onboarding/create-organization", sessionOrgId: null };
}
