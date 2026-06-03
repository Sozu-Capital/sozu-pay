import "server-only";

import { Keypair } from "@stellar/stellar-sdk";
import type { Organization } from "@/lib/db/organizations";
import { decryptOrgSecret } from "@/lib/org-secret";
import { isUserDerivedEncrypted } from "@/lib/org-wallet-encryption";

/** Per-org SDP distribution G-account (no global env fallback — org isolation). */
export function resolveOrgDistributionPublicKey(org: Organization): string | null {
  const orgPk = org.stellar_disbursement_public_key?.trim().replace(/^stellar:/i, "") ?? "";
  if (orgPk.startsWith("G")) return orgPk;
  return null;
}

/** Server-side secret for sweep-back when org secret is available. */
export function resolveOrgDistributionSecret(org: Organization): string | null {
  const pk = resolveOrgDistributionPublicKey(org);
  if (!pk) return null;

  const enc = org.stellar_disbursement_secret_encrypted;
  if (enc && !isUserDerivedEncrypted(enc)) {
    try {
      const secret = decryptOrgSecret(org.id, enc);
      if (secret && keypairMatchesPublicKey(secret, pk)) return secret;
    } catch {
      // org secret not server-decryptable
    }
  }

  return null;
}

function keypairMatchesPublicKey(secret: string, publicKey: string): boolean {
  try {
    return Keypair.fromSecret(secret).publicKey() === publicKey;
  } catch {
    return false;
  }
}

export function isOrgDistributionConfigured(org: Organization): boolean {
  return Boolean(resolveOrgDistributionPublicKey(org));
}

export function isOrgDistributionSweepBackEnabled(org: Organization): boolean {
  return Boolean(resolveOrgDistributionPublicKey(org) && resolveOrgDistributionSecret(org));
}
