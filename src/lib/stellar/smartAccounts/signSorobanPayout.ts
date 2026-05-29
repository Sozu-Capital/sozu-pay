"use client";

import type { SmartAccountKit } from "smart-account-kit";
import type { xdr } from "@stellar/stellar-sdk";

/**
 * Sign Soroban auth entries on a server-prepared payout envelope using passkey.
 */
export async function signSorobanEnvelopeWithPasskey(params: {
  kit: SmartAccountKit;
  envelopeXdr: string;
  networkPassphrase: string;
  credentialId?: string | null;
}): Promise<string> {
  const { Transaction, TransactionBuilder, Operation } = await import("@stellar/stellar-sdk");

  const tx = new Transaction(params.envelopeXdr, params.networkPassphrase);
  if (tx.operations.length !== 1) {
    throw new Error("Expected a single Soroban operation.");
  }

  const op = tx.operations[0];
  if (op.type !== "invokeHostFunction") {
    throw new Error("Expected invokeHostFunction operation.");
  }

  const invokeOp = op as {
    type: "invokeHostFunction";
    func: xdr.HostFunction;
    auth?: xdr.SorobanAuthorizationEntry[];
  };
  const authEntries = invokeOp.auth ?? [];
  const signedAuth = [];
  for (const entry of authEntries) {
    signedAuth.push(
      await params.kit.signAuthEntry(entry, {
        credentialId: params.credentialId ?? undefined,
      })
    );
  }

  const sourceAccount = await params.kit.rpc.getAccount(tx.source);
  const rebuilt = new TransactionBuilder(sourceAccount, {
    fee: tx.fee,
    networkPassphrase: params.networkPassphrase,
  })
    .addOperation(
      Operation.invokeHostFunction({
        func: invokeOp.func,
        auth: signedAuth,
      })
    )
    .setTimeout(60)
    .build();

  const prepared = await params.kit.rpc.prepareTransaction(rebuilt);
  return prepared.toEnvelope().toXDR("base64");
}

export type PasskeySorobanPayoutResult = {
  stellarTxHash: string;
  payout: {
    amount?: string;
    stellarTxHash?: string;
    recipientLabel?: string;
    stellarAddress?: string;
  };
};

/**
 * Full passkey payout: prepare → sign auth → submit.
 */
export async function executePasskeySorobanPayout(params: {
  kit: SmartAccountKit;
  credentialId?: string | null;
  payoutId: string;
  recipientAddress: string;
  amount: string;
}): Promise<PasskeySorobanPayoutResult> {
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
  if (!connected?.contractId) {
    throw new Error("Passkey wallet not connected.");
  }

  const prepareRes = await fetch("/api/payouts/prepare-soroban", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      recipientAddress: params.recipientAddress,
      amount: params.amount,
      payoutId: params.payoutId,
    }),
  });
  const prepared = (await prepareRes.json().catch(() => ({}))) as {
    envelopeXdr?: string;
    error?: string;
  };
  if (!prepareRes.ok || !prepared.envelopeXdr) {
    throw new Error(prepared.error ?? "Failed to prepare Soroban payout.");
  }

  const signedEnvelopeXdr = await signSorobanEnvelopeWithPasskey({
    kit: params.kit,
    envelopeXdr: prepared.envelopeXdr,
    networkPassphrase: config.networkPassphrase,
    credentialId: params.credentialId ?? connected.credentialId,
  });

  const submitRes = await fetch("/api/payouts/submit-signed-soroban", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      signedEnvelopeXdr,
      payoutId: params.payoutId,
    }),
  });
  const submitted = (await submitRes.json().catch(() => ({}))) as {
    payout?: PasskeySorobanPayoutResult["payout"];
    error?: string;
  };
  if (!submitRes.ok) {
    throw new Error(submitted.error ?? "Failed to submit Soroban payout.");
  }

  const txHash = submitted.payout?.stellarTxHash ?? "";
  if (!txHash) {
    throw new Error("Payout submitted but no transaction hash returned.");
  }

  return { stellarTxHash: txHash, payout: submitted.payout ?? {} };
}
