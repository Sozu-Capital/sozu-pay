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

/**
 * Connect the kit to the logged-in user's member wallet (login passkey + DB contract).
 * Avoids default connectWallet() picking the most recently created kit wallet.
 */
export async function connectSessionPasskeyWallet(
  kit: SmartAccountKit,
  opts?: {
    prompt?: boolean;
    credentialId?: string | null;
    contractId?: string | null;
  }
): Promise<{
  contractId: string | null;
  credentialId: string | null;
  publicKey: Uint8Array | null;
} | null> {
  const session = await fetchSessionPasskeyWallet();
  if (!session) {
    throw new Error("Could not load passkey signing context. Sign out and sign in again.");
  }

  const credentialId =
    opts?.credentialId?.trim() ||
    session.signingCredentialId?.trim() ||
    session.loginCredentialId?.trim() ||
    null;
  const contractId = opts?.contractId?.trim() || session.memberContractId?.trim() || null;

  if (!credentialId) {
    throw new Error("No login passkey found for this account.");
  }
  if (!contractId) {
    throw new Error("Set up your passkey smart wallet before signing transactions.");
  }

  if (!contractId) {
    if (!opts?.prompt) return null;
    const connected = await kit.connectWallet({
      prompt: true,
      credentialId: credentialId ?? undefined,
    });
    if (!connected?.contractId || !connected.credentialId) {
      throw new Error("Passkey authorization was cancelled or unavailable.");
    }
    return {
      contractId: connected.contractId,
      credentialId: connected.credentialId,
      publicKey: connected.credential?.publicKey ?? null,
    };
  }

  const connected = await kit.connectWallet({
    prompt: opts?.prompt ?? false,
    credentialId,
    contractId,
  });

  if (!connected?.contractId || !connected.credentialId) {
    if (opts?.prompt) {
      throw new Error("Passkey authorization was cancelled or unavailable.");
    }
    return null;
  }

  const expected = contractId.toUpperCase();
  const got = connected.contractId.trim().toUpperCase();
  if (got !== expected) {
    throw new Error(
      "This passkey is not linked to your org member wallet. Use the same passkey you signed in with."
    );
  }

  return {
    contractId: connected.contractId,
    credentialId: connected.credentialId,
    publicKey: connected.credential?.publicKey ?? null,
  };
}
