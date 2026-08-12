"use client";

import type { SmartAccountKit } from "smart-account-kit";

export type SessionPasskeyWallet = {
  loginCredentialId: string | null;
  signingCredentialId: string | null;
  memberContractId: string | null;
  username: string | null;
  smartWalletReady: boolean;
};

export async function fetchSessionPasskeyWallet(): Promise<SessionPasskeyWallet | null> {
  const res = await fetch("/api/smart-accounts/signing-context", { credentials: "include" });
  const data = (await res.json().catch(() => ({}))) as SessionPasskeyWallet & { error?: string };
  if (!res.ok) return null;
  return data;
}

export function sessionPasskeyConnectTarget(
  session: SessionPasskeyWallet | null,
  opts?: { credentialId?: string | null; contractId?: string | null },
): { credentialId: string; contractId: string } | null {
  if (!session) return null;
  const credentialId =
    opts?.credentialId?.trim() ||
    session.signingCredentialId?.trim() ||
    session.loginCredentialId?.trim() ||
    "";
  const contractId = opts?.contractId?.trim() || session.memberContractId?.trim() || "";
  if (!credentialId || !contractId) return null;
  return { credentialId, contractId };
}

/**
 * Connect the kit to the logged-in user's member wallet (login passkey + DB contract).
 * Avoids default connectWallet() picking the most recently created kit wallet.
 * Silent init (prompt false) returns null when there is no wallet yet — do not throw.
 */
export async function connectSessionPasskeyWallet(
  kit: SmartAccountKit,
  opts?: {
    prompt?: boolean;
    credentialId?: string | null;
    contractId?: string | null;
  },
): Promise<{
  contractId: string | null;
  credentialId: string | null;
  publicKey: Uint8Array | null;
} | null> {
  const session = await fetchSessionPasskeyWallet();
  const target = sessionPasskeyConnectTarget(session, opts);

  if (!target) {
    if (opts?.prompt) {
      throw new Error(
        session
          ? "Set up your passkey smart wallet before signing transactions."
          : "Could not load passkey signing context. Sign out and sign in again.",
      );
    }
    return null;
  }

  const connected = await kit.connectWallet({
    prompt: opts?.prompt ?? false,
    credentialId: target.credentialId,
    contractId: target.contractId,
  });

  if (!connected?.contractId || !connected.credentialId) {
    if (opts?.prompt) {
      throw new Error("Passkey authorization was cancelled or unavailable.");
    }
    return null;
  }

  const expected = target.contractId.toUpperCase();
  const got = connected.contractId.trim().toUpperCase();
  if (got !== expected) {
    throw new Error(
      "This passkey is not linked to your org member wallet. Use the same passkey you signed in with.",
    );
  }

  return {
    contractId: connected.contractId,
    credentialId: connected.credentialId,
    publicKey: connected.credential?.publicKey ?? null,
  };
}
