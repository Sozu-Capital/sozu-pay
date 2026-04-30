/**
 * Helpers for org wallet encryption format detection.
 * User-derived format (v1): client encrypts with payout password; server never decrypts.
 * Legacy format: server decrypts with AUTH_SECRET + org_id.
 */

export type UserDerivedEncryptedBlob = {
  v: 1;
  salt: string;
  iv: string;
  ciphertext: string;
  iterations: number;
};

/**
 * Returns true if the stored value is user-derived encrypted (JSON with v === 1).
 * Server must not attempt to decrypt these with AUTH_SECRET.
 */
export function isUserDerivedEncrypted(encrypted: string | null | undefined): boolean {
  if (!encrypted || typeof encrypted !== "string") return false;
  try {
    const j = JSON.parse(encrypted) as { v?: number };
    return j?.v === 1;
  } catch {
    return false;
  }
}
