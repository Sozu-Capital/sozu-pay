export type PollarVerifiedIdentity = {
  /** Stable Pollar end-user id (subject). */
  subject: string;
  email: string;
  /** Optional wallet address from Pollar session (Staff Pollar identity). */
  walletAddress?: string | null;
  authProvider?: string | null;
};

export interface PollarTokenVerifier {
  verify(token: string): Promise<PollarVerifiedIdentity>;
}

export class PollarTokenVerifyError extends Error {
  constructor(
    message: string,
    readonly code: string = "POLLAR_TOKEN_INVALID",
  ) {
    super(message);
    this.name = "PollarTokenVerifyError";
  }
}

/** Stable fake G-address for local/fake Pollar identity + treasury binding. */
export const FAKE_POLLAR_STAFF_WALLET =
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

/** True for the fake-auth sentinel — valid StrKey, but not a receivable funded wallet. */
export function isFakePollarStaffWallet(address: string | null | undefined): boolean {
  if (!address) return false;
  return address.trim().toUpperCase() === FAKE_POLLAR_STAFF_WALLET;
}

/**
 * Classic G usable as org treasury / $tag destination.
 * Rejects empty, non-G, and the fake Pollar sentinel.
 */
export function usableClassicTreasuryPublicKey(
  address: string | null | undefined,
): string | null {
  const key = (address ?? "").trim();
  if (!key.startsWith("G") || key.length < 56) return null;
  if (isFakePollarStaffWallet(key)) return null;
  return key;
}
