/**
 * Resolve which key signs org Stellar payouts.
 * Pollar orgs debit Home treasury (org.stellar_disbursement_public_key) only —
 * never the shared env hot key unless that secret's public key is the Home G.
 *
 * Pure / testable: callers supply already-decrypted org / unlock secrets.
 */
import { Keypair } from "@stellar/stellar-sdk";
import type { Organization } from "@/lib/db/organizations";
import { isPollarMappedUser } from "@/lib/pollar/session-bridge";
import { canServerExecuteOrgSpend } from "@/lib/pollar/spend";
import { isUserDerivedEncrypted } from "@/lib/org-wallet-encryption";

const ORG_SECRET_ENV_KEYS = [
  "ORG_DISBURSEMENT_SECRET",
  "STELLAR_DISBURSEMENT_SECRET",
  "STELLAR_FUNDER_SECRET",
] as const;

function envDisbursementPublicKey(): string | null {
  for (const key of ORG_SECRET_ENV_KEYS) {
    const secret = process.env[key]?.trim();
    if (!secret) continue;
    try {
      return Keypair.fromSecret(secret).publicKey();
    } catch {
      return null;
    }
  }
  return null;
}

export type HomeTreasurySignerMode =
  | "org_stored"
  | "unlocked"
  | "env_aligned"
  | "legacy_env"
  | "pollar_fake"
  | "pollar_client"
  | "require_unlock"
  | "require_payout_password"
  | "missing";

export type HomeTreasurySignerResult = {
  mode: HomeTreasurySignerMode;
  signerSecretKey?: string;
  /** Classic G that must appear as the debit source (audit / client). */
  fromAddress?: string;
  requireUnlock: boolean;
  requirePayoutPassword: boolean;
};

function classicG(value: string | null | undefined): string | null {
  const pk = (value ?? "").trim();
  return pk.startsWith("G") && pk.length >= 56 ? pk : null;
}

function orgTreasuryPublicKey(org: Organization | null): string | null {
  return classicG(org?.stellar_disbursement_public_key);
}

/** Env disbursement secret only when its public key equals expectedFrom. */
export function getEnvSecretAlignedTo(expectedFrom: string): string | undefined {
  const want = expectedFrom.trim();
  if (!want.startsWith("G")) return undefined;
  for (const key of ORG_SECRET_ENV_KEYS) {
    const secret = process.env[key]?.trim();
    if (!secret) continue;
    try {
      if (Keypair.fromSecret(secret).publicKey() === want) return secret;
    } catch {
      // skip invalid
    }
  }
  return undefined;
}

function publicKeyOfSecret(secret: string): string | null {
  try {
    return Keypair.fromSecret(secret).publicKey();
  } catch {
    return null;
  }
}

export function usesPollarHomeTreasury(
  user: { privy_user_id: string } | null | undefined,
  org: Organization | null,
): boolean {
  return !!user && isPollarMappedUser(user) && !!orgTreasuryPublicKey(org);
}

/**
 * Resolve signer for a Stellar payout.
 * @param pollarHomeTreasury - when true, never fall through to a mismatched env hot key
 * @param orgStoredSecret - legacy server-decryptable org secret (already decrypted)
 * @param unlockedSecret - unlocked payout key from memory/cookie (already decrypted)
 */
export function resolveHomeTreasurySigner(params: {
  org: Organization | null;
  pollarHomeTreasury: boolean;
  orgStoredSecret?: string;
  unlockedSecret?: string;
  /** Logged-in Pollar G — browser can only debit this wallet, not a different Home G. */
  sessionPublicKey?: string | null;
}): HomeTreasurySignerResult {
  const { org, pollarHomeTreasury, orgStoredSecret, unlockedSecret } = params;
  const homeG = orgTreasuryPublicKey(org);
  const sessionG = classicG(params.sessionPublicKey);

  if (
    org?.stellar_disbursement_secret_encrypted &&
    isUserDerivedEncrypted(org.stellar_disbursement_secret_encrypted)
  ) {
    return {
      mode: "require_payout_password",
      fromAddress: homeG ?? undefined,
      requireUnlock: true,
      requirePayoutPassword: true,
    };
  }

  if (orgStoredSecret) {
    return {
      mode: "org_stored",
      signerSecretKey: orgStoredSecret,
      fromAddress: publicKeyOfSecret(orgStoredSecret) ?? homeG ?? undefined,
      requireUnlock: false,
      requirePayoutPassword: false,
    };
  }

  if (unlockedSecret) {
    const unlockedPk = publicKeyOfSecret(unlockedSecret);
    if (!pollarHomeTreasury || !homeG || unlockedPk === homeG) {
      return {
        mode: "unlocked",
        signerSecretKey: unlockedSecret,
        fromAddress: unlockedPk ?? homeG ?? undefined,
        requireUnlock: false,
        requirePayoutPassword: false,
      };
    }
  }

  if (pollarHomeTreasury && homeG) {
    const aligned = getEnvSecretAlignedTo(homeG);
    if (aligned) {
      return {
        mode: "env_aligned",
        signerSecretKey: aligned,
        fromAddress: homeG,
        requireUnlock: false,
        requirePayoutPassword: false,
      };
    }
    if (canServerExecuteOrgSpend()) {
      return {
        mode: "pollar_fake",
        fromAddress: homeG,
        requireUnlock: false,
        requirePayoutPassword: false,
      };
    }
    return {
      mode: "pollar_client",
      fromAddress: sessionG ?? homeG,
      requireUnlock: false,
      requirePayoutPassword: false,
    };
  }

  // Legacy / non-Pollar: optional env hot key (signerSecretKey undefined → sendUsdc uses env).
  const legacyEnvPk = envDisbursementPublicKey();
  if (legacyEnvPk) {
    return {
      mode: "legacy_env",
      signerSecretKey: undefined,
      fromAddress: legacyEnvPk,
      requireUnlock: false,
      requirePayoutPassword: false,
    };
  }

  if (homeG) {
    return {
      mode: "missing",
      fromAddress: homeG,
      requireUnlock: true,
      requirePayoutPassword: false,
    };
  }

  return {
    mode: "require_unlock",
    requireUnlock: true,
    requirePayoutPassword: false,
  };
}
