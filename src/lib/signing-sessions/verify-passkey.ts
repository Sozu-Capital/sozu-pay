import { getMemberSmartAccount } from "@/lib/db/smart-accounts";
import { getWebauthnCredentialForUser } from "@/lib/db/webauthn-credentials";
import { logPasskeyEvent } from "@/lib/passkey/log";
import type { User } from "@/lib/db/users";

export async function verifyPasskeyAuthorization(params: {
  user: User;
  credentialId: string;
  contractId: string;
  disbursementId: string;
  sessionId?: string;
}): Promise<{ ok: true } | { ok: false; error: string; code: string }> {
  const orgId = params.user.org_id;
  if (!orgId) {
    return { ok: false, error: "No organization.", code: "NO_ORG" };
  }

  const smartAccount = await getMemberSmartAccount(orgId, params.user.id);
  if (!smartAccount) {
    logPasskeyEvent("warn", {
      action: "verify_passkey",
      userId: params.user.id,
      disbursementId: params.disbursementId,
      sessionId: params.sessionId,
      reason: "no_smart_account",
    });
    return {
      ok: false,
      error: "Passkey smart wallet not registered for this profile.",
      code: "SMART_WALLET_REQUIRED",
    };
  }

  if (smartAccount.contract_id !== params.contractId) {
    logPasskeyEvent("warn", {
      action: "verify_passkey",
      userId: params.user.id,
      disbursementId: params.disbursementId,
      sessionId: params.sessionId,
      reason: "contract_mismatch",
      details: { expected: smartAccount.contract_id, got: params.contractId },
    });
    return {
      ok: false,
      error: "Smart account does not match your registered passkey wallet.",
      code: "CONTRACT_MISMATCH",
    };
  }

  const cred = await getWebauthnCredentialForUser({
    userId: params.user.id,
    orgId,
    credentialId: params.credentialId,
  });
  if (!cred) {
    logPasskeyEvent("warn", {
      action: "verify_passkey",
      userId: params.user.id,
      disbursementId: params.disbursementId,
      sessionId: params.sessionId,
      reason: "credential_not_registered",
      details: { credentialId: params.credentialId },
    });
    return {
      ok: false,
      error: "Passkey credential is not registered for your profile.",
      code: "CREDENTIAL_NOT_REGISTERED",
    };
  }

  logPasskeyEvent("info", {
    action: "verify_passkey_ok",
    userId: params.user.id,
    disbursementId: params.disbursementId,
    sessionId: params.sessionId,
    details: { contractId: params.contractId, credentialId: params.credentialId },
  });

  return { ok: true };
}
