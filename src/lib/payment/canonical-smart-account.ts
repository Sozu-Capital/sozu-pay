/**
 * One Sozu account has one smart-account address.
 * The first C… written for that account is canonical.
 * See docs/adr/0004-one-canonical-smart-account.md.
 */

export const CANONICAL_SMART_ACCOUNT_IMMUTABLE = "CANONICAL_SMART_ACCOUNT_IMMUTABLE";

export function isSmartAccountContractId(value: string | null | undefined): boolean {
  const v = value?.trim().toUpperCase() ?? "";
  return /^C[A-Z0-9]{55}$/.test(v);
}

export type CanonicalSmartAccountSource = "stellar_wallets" | "org_treasury";

/**
 * Receive address for a Sozu account.
 * A stored smart account wins over an org treasury. The treasury is only
 * the address when this account has no smart account yet.
 */
export function selectCanonicalSmartAccount(input: {
  walletPublicKey?: string | null;
  orgTreasuryContractId?: string | null;
}): { contractId: string; source: CanonicalSmartAccountSource } | null {
  const wallet = input.walletPublicKey?.trim().toUpperCase() ?? "";
  if (isSmartAccountContractId(wallet)) {
    return { contractId: wallet, source: "stellar_wallets" };
  }
  const treasury = input.orgTreasuryContractId?.trim().toUpperCase() ?? "";
  if (isSmartAccountContractId(treasury)) {
    return { contractId: treasury, source: "org_treasury" };
  }
  return null;
}

export type CanonicalWriteDecision =
  | { action: "keep"; contractId: string }
  | { action: "reject"; contractId: string }
  | { action: "write"; contractId: string };

/** An existing C… is kept. A different address is rejected. Empty or classic G… may be written once. */
export type TagOwnerCandidate = {
  id: string;
  username?: string | null;
  walletCreatedAt?: string | null;
};

/** `$FrankOcean` and `frankocean` are one tag. */
export function isSameSozuTag(a: string, b: string): boolean {
  return a.trim().replace(/^\$+/, "").toLowerCase() === b.trim().replace(/^\$+/, "").toLowerCase();
}

/** If case-variant profiles exist, the earliest wallet keeps the tag. */
export function pickTagOwner<T extends TagOwnerCandidate>(profiles: T[]): T | null {
  if (profiles.length === 0) return null;
  return [...profiles].sort((a, b) => {
    const aAt = a.walletCreatedAt ?? "9999-12-31T23:59:59.999Z";
    const bAt = b.walletCreatedAt ?? "9999-12-31T23:59:59.999Z";
    if (aAt !== bAt) return aAt < bAt ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  })[0];
}

export function canonicalWriteDecision(
  existing: string | null | undefined,
  requested: string,
): CanonicalWriteDecision {
  const next = requested.trim().toUpperCase();
  const current = existing?.trim().toUpperCase() ?? "";
  const currentIsSmartAccount = isSmartAccountContractId(current);
  const nextIsSmartAccount = isSmartAccountContractId(next);

  if (!nextIsSmartAccount) {
    if (currentIsSmartAccount) return { action: "reject", contractId: current };
    return { action: "write", contractId: next };
  }
  if (currentIsSmartAccount && current === next) return { action: "keep", contractId: current };
  if (currentIsSmartAccount) return { action: "reject", contractId: current };
  return { action: "write", contractId: next };
}
