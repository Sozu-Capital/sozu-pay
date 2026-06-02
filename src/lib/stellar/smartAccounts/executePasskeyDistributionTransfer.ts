"use client";

import type { SmartAccountKit } from "smart-account-kit";
import { signSorobanEnvelopeWithPasskey } from "@/lib/stellar/smartAccounts/signSorobanPayout";

export type DistributionTransferDirection = "to_distribution" | "to_treasury";

export type DistributionTransferResult = {
  stellarTxHash: string;
  direction: DistributionTransferDirection;
  amount: string;
};

/**
 * Fund SDP distribution from org treasury (passkey-signed Soroban) or sweep back (passkey gate + server).
 */
export async function executePasskeyDistributionTransfer(params: {
  kit: SmartAccountKit;
  credentialId?: string | null;
  direction: DistributionTransferDirection;
  amount: string;
}): Promise<DistributionTransferResult> {
  const configRes = await fetch("/api/smart-accounts/config", { credentials: "include" });
  const config = (await configRes.json().catch(() => ({}))) as {
    networkPassphrase?: string;
    error?: string;
  };
  if (!configRes.ok || !config.networkPassphrase) {
    throw new Error(config.error ?? "Smart account config unavailable.");
  }

  const connected = await params.kit.connectWallet({
    prompt: true,
    credentialId: params.credentialId ?? undefined,
  });
  if (!connected?.contractId || !connected.credentialId) {
    throw new Error("Passkey wallet not connected.");
  }

  const prepareRes = await fetch("/api/treasury/distribution/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      direction: params.direction,
      amount: params.amount,
    }),
  });
  const prepared = (await prepareRes.json().catch(() => ({}))) as {
    envelopeXdr?: string;
    error?: string;
    code?: string;
  };
  if (!prepareRes.ok) {
    throw new Error(prepared.error ?? "Failed to prepare transfer.");
  }

  let signedEnvelopeXdr = "";
  if (params.direction === "to_distribution") {
    if (!prepared.envelopeXdr) {
      throw new Error("Server did not return an envelope to sign.");
    }
    signedEnvelopeXdr = await signSorobanEnvelopeWithPasskey({
      kit: params.kit,
      envelopeXdr: prepared.envelopeXdr,
      networkPassphrase: config.networkPassphrase,
      credentialId: connected.credentialId,
    });
  }

  const submitRes = await fetch("/api/treasury/distribution/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      direction: params.direction,
      amount: params.amount,
      signedEnvelopeXdr: signedEnvelopeXdr || undefined,
      credentialId: connected.credentialId,
      contractId: connected.contractId,
    }),
  });
  const submitted = (await submitRes.json().catch(() => ({}))) as {
    stellarTxHash?: string;
    error?: string;
  };
  if (!submitRes.ok) {
    throw new Error(submitted.error ?? "Transfer submission failed.");
  }
  if (!submitted.stellarTxHash) {
    throw new Error("Transfer completed but no transaction hash returned.");
  }

  return {
    stellarTxHash: submitted.stellarTxHash,
    direction: params.direction,
    amount: params.amount,
  };
}
