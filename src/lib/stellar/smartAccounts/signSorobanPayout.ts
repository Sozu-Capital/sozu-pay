"use client";

import type { SmartAccountKit } from "smart-account-kit";
import type { xdr } from "@stellar/stellar-sdk";
import {
  signAuthEntryWithResolvedKeyData,
  smartAccountIdFromAuthEntry,
} from "@/lib/stellar/smartAccounts/signSorobanWebAuthnAuth";
import { connectSessionPasskeyWallet } from "@/lib/stellar/smartAccounts/sessionWallet";

function isMissingSignerError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /no signer found|not registered on that smart account/i.test(msg);
}

/**
 * Sign Soroban auth entries on a server-prepared payout envelope using passkey.
 * Supports multiple smart accounts in one tx (e.g. treasury sweep + member payout).
 */
export async function signSorobanEnvelopeWithPasskey(params: {
  kit: SmartAccountKit;
  envelopeXdr: string;
  networkPassphrase: string;
  credentialId?: string | null;
  /** Member/disbursement signer contract — used as the first passkey attempt. */
  primaryContractId?: string | null;
}): Promise<string> {
  const { Transaction, TransactionBuilder, Operation } = await import("@stellar/stellar-sdk");

  const cfgRes = await fetch("/api/smart-accounts/config", { credentials: "include" });
  const cfg = (await cfgRes.json().catch(() => ({}))) as { webauthnVerifierAddress?: string };
  const webauthnVerifier = cfg.webauthnVerifierAddress?.trim() ?? "";
  if (!webauthnVerifier) {
    throw new Error("Smart account verifier not configured.");
  }

  const tx = new Transaction(params.envelopeXdr, params.networkPassphrase);
  if (tx.operations.length === 0) {
    throw new Error("Prepared payout has no operations.");
  }

  if (!tx.source.startsWith("G")) {
    throw new Error(
      "Invalid prepared payout: fee payer must be a classic G address, not a smart account (C…)."
    );
  }

  const credentialByContract = new Map<string, string>();
  const primaryContract = params.primaryContractId?.trim().toUpperCase();
  const seedCredential = params.credentialId?.trim();
  if (primaryContract && seedCredential) {
    credentialByContract.set(primaryContract, seedCredential);
  }

  async function resolveCredentialForContract(contractId: string, forcePrompt: boolean): Promise<string> {
    const key = contractId.trim().toUpperCase();
    if (!forcePrompt && credentialByContract.has(key)) {
      return credentialByContract.get(key)!;
    }

    const connected = await params.kit.connectWallet({
      prompt: true,
      contractId: key,
      credentialId: forcePrompt ? undefined : seedCredential ?? undefined,
    });
    const cred = connected?.credentialId?.trim();
    if (!cred) {
      throw new Error("Passkey authorization was cancelled or unavailable.");
    }
    credentialByContract.set(key, cred);
    return cred;
  }

  async function signEntry(entry: xdr.SorobanAuthorizationEntry): Promise<xdr.SorobanAuthorizationEntry> {
    const smartAccountId = smartAccountIdFromAuthEntry(entry);
    let credentialId = await resolveCredentialForContract(smartAccountId, false);

    try {
      return await signAuthEntryWithResolvedKeyData({
        entry,
        credentialId,
        networkPassphrase: params.networkPassphrase,
        webauthnVerifierAddress: webauthnVerifier,
        smartAccountContractId: smartAccountId,
      });
    } catch (e) {
      if (!isMissingSignerError(e)) throw e;
      credentialByContract.delete(smartAccountId.trim().toUpperCase());
      credentialId = await resolveCredentialForContract(smartAccountId, true);
      try {
        return await signAuthEntryWithResolvedKeyData({
          entry,
          credentialId,
          networkPassphrase: params.networkPassphrase,
          webauthnVerifierAddress: webauthnVerifier,
          smartAccountContractId: smartAccountId,
        });
      } catch (retryErr) {
        if (isMissingSignerError(retryErr)) {
          throw new Error(
            `This passkey is not registered on smart account ${smartAccountId.slice(0, 8)}…. ` +
              "If this tx sweeps from org treasury, approve again with the passkey you used when creating the org treasury wallet."
          );
        }
        throw retryErr;
      }
    }
  }

  const signedOperations = [];
  for (const op of tx.operations) {
    if (op.type !== "invokeHostFunction") {
      throw new Error("Expected invokeHostFunction operations only.");
    }

    const invokeOp = op as {
      type: "invokeHostFunction";
      source?: string;
      func: xdr.HostFunction;
      auth?: xdr.SorobanAuthorizationEntry[];
    };
    const authEntries = invokeOp.auth ?? [];
    if (authEntries.length === 0) {
      throw new Error(
        "No Soroban auth entries to sign. Ensure your passkey smart wallet is registered as an org signer."
      );
    }

    const signedAuth = [];
    for (const entry of authEntries) {
      signedAuth.push(await signEntry(entry));
    }

    signedOperations.push(
      Operation.invokeHostFunction({
        source: invokeOp.source,
        func: invokeOp.func,
        auth: signedAuth,
      })
    );
  }

  const sourceAccount = await params.kit.rpc.getAccount(tx.source);
  const rebuilt = new TransactionBuilder(sourceAccount, {
    fee: tx.fee,
    networkPassphrase: params.networkPassphrase,
  }).setTimeout(60);

  for (const signedOp of signedOperations) {
    rebuilt.addOperation(signedOp);
  }

  return rebuilt.build().toEnvelope().toXDR("base64");
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
  recipientLabel?: string;
}): Promise<PasskeySorobanPayoutResult> {
  const configRes = await fetch("/api/smart-accounts/config", { credentials: "include" });
  const config = (await configRes.json().catch(() => ({}))) as {
    networkPassphrase?: string;
    error?: string;
  };
  if (!configRes.ok || !config.networkPassphrase) {
    throw new Error(config.error ?? "Smart account config unavailable.");
  }

  const connected = await connectSessionPasskeyWallet(params.kit, {
    prompt: true,
    credentialId: params.credentialId,
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
    primaryContractId: connected.contractId,
  });

  const submitRes = await fetch("/api/payouts/submit-signed-soroban", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      signedEnvelopeXdr,
      payoutId: params.payoutId,
      amount: params.amount,
      destination: params.recipientAddress,
      recipientLabel: params.recipientLabel,
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
