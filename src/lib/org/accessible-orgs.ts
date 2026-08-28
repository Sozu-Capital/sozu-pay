/** Merge every org a user can open: primary row, session, memberships, treasury-manager, Staff wallet. */
export function mergeAccessibleOrgIds(parts: {
  primaryOrgId?: string | null;
  sessionOrgId?: string | null;
  memberOrgIds?: string[];
  managedOrgIds?: string[];
  staffWalletOrgIds?: string[];
}): string[] {
  return [
    ...new Set(
      [
        parts.primaryOrgId,
        parts.sessionOrgId,
        ...(parts.memberOrgIds ?? []),
        ...(parts.managedOrgIds ?? []),
        ...(parts.staffWalletOrgIds ?? []),
      ].filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
}

/**
 * Org the user is currently operating on.
 *
 * Dashboard UI uses session.orgId when present; invite/payout writes must
 * follow the same org. Never fall back to users.org_id (primary) while a
 * different session org is selected — that is the tenant-mixup bug.
 *
 * `accessibleOrgIds` must come from memberships/primary/managed/wallet only
 * (do not treat the session cookie as proof of access).
 */
export function pickActiveOrgId(params: {
  sessionOrgId?: string | null;
  primaryOrgId?: string | null;
  accessibleOrgIds: string[];
}): string | null {
  const allowed = new Set(
    params.accessibleOrgIds.filter((id): id is string => typeof id === "string" && id.length > 0),
  );
  if (params.sessionOrgId) {
    return allowed.has(params.sessionOrgId) ? params.sessionOrgId : null;
  }
  if (params.primaryOrgId && allowed.has(params.primaryOrgId)) {
    return params.primaryOrgId;
  }
  return null;
}

export type OrgTreasuryIdentity = {
  id: string;
  stellar_disbursement_public_key?: string | null;
  sozu_tag_auth_user_id?: string | null;
  created_at?: string | null;
};

function classicG(value: string | null | undefined): string | null {
  const g = (value ?? "").trim();
  return g.startsWith("G") && g.length >= 56 ? g : null;
}

/** Oldest tagged org wins when several rows share one Pollar Staff G (ghost clones). */
export function pickCanonicalOrgIdForSharedG(orgs: OrgTreasuryIdentity[]): string | null {
  if (orgs.length === 0) return null;
  const ranked = [...orgs].sort((a, b) => {
    const tagA = a.sozu_tag_auth_user_id ? 1 : 0;
    const tagB = b.sozu_tag_auth_user_id ? 1 : 0;
    if (tagA !== tagB) return tagB - tagA;
    const tA = a.created_at ?? "";
    const tB = b.created_at ?? "";
    if (tA !== tB) return tA < tB ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
  return ranked[0]?.id ?? null;
}

/**
 * One Pollar Staff G can only fund one real org. Extra create-org rows that copied
 * the same G (e.g. Mi negocio444 vs Dabruno) must not appear as separate treasuries.
 */
export function collapseOrgIdsSharingTreasury(orgs: OrgTreasuryIdentity[]): string[] {
  const byG = new Map<string, OrgTreasuryIdentity[]>();
  const kept: string[] = [];
  const seen = new Set<string>();
  const pushUnique = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    kept.push(id);
  };

  for (const org of orgs) {
    const g = classicG(org.stellar_disbursement_public_key);
    if (!g) {
      pushUnique(org.id);
      continue;
    }
    const group = byG.get(g) ?? [];
    group.push(org);
    byG.set(g, group);
  }
  for (const group of byG.values()) {
    const canonical = pickCanonicalOrgIdForSharedG(group);
    if (canonical) pushUnique(canonical);
  }
  return kept;
}

export function remapToCanonicalOrgId(
  selectedId: string,
  orgs: OrgTreasuryIdentity[],
): string {
  const selected = orgs.find((org) => org.id === selectedId);
  if (!selected) return selectedId;
  const g = classicG(selected.stellar_disbursement_public_key);
  if (!g) return selectedId;
  const siblings = orgs.filter((org) => classicG(org.stellar_disbursement_public_key) === g);
  if (siblings.length <= 1) return selectedId;
  return pickCanonicalOrgIdForSharedG(siblings) ?? selectedId;
}

/** A second Pollar org cannot reuse a Staff G already bound as another org's treasury. */
export function staffTreasuryAlreadyBound(existingOrgIds: string[]): boolean {
  return existingOrgIds.some((id) => typeof id === "string" && id.length > 0);
}

/**
 * Bind the creator's Staff G only when no org already uses it.
 * Otherwise leave null so testnet provisioner creates a unique treasury G.
 */
export function staffGForNewOrg(params: {
  staffPublicKey: string | null;
  alreadyBound: boolean;
}): string | null {
  if (params.alreadyBound) return null;
  const g = (params.staffPublicKey ?? "").trim();
  return g.startsWith("G") && g.length >= 56 ? g : null;
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
