/**
 * Handle API response that requires Pollar custodial signing, then complete the payout.
 */
"use client";

import { sendUsdcViaPollarClient } from "@/lib/pollar/client-usdc-send";
import type { PayoutAsset } from "@/lib/payouts/asset";

export type PollarClientTxChallenge = {
  requirePollarClientTx: true;
  payoutId: string;
  amount: string;
  destination: string;
  fromAddress: string;
  recipientLabel?: string;
  sacContractId?: string;
  asset?: PayoutAsset;
  amountI128?: string;
};

export function isPollarClientTxChallenge(
  data: unknown,
): data is PollarClientTxChallenge {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    d.requirePollarClientTx === true &&
    typeof d.payoutId === "string" &&
    typeof d.amount === "string" &&
    typeof d.destination === "string" &&
    typeof d.fromAddress === "string"
  );
}

export async function executeAndCompletePollarClientPayout(
  challenge: PollarClientTxChallenge,
): Promise<{
  payout: {
    amount?: string;
    stellarTxHash?: string;
    stellarAddress?: string;
    recipientLabel?: string;
  };
  stellarTxHash: string;
}> {
  // Belt-and-suspenders: server also tops up on requirePollarClientTx, but
  // cover older deploys / race where spendable XLM is still too low.
  try {
    await fetch("/api/payouts/ensure-fee-xlm", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: challenge.fromAddress }),
    });
  } catch {
    // non-fatal — Pollar may still succeed if sponsorship covers fees
  }

  const { stellarTxHash } = await sendUsdcViaPollarClient({
    destination: challenge.destination,
    amount: challenge.amount,
    fromAddress: challenge.fromAddress,
    sacContractId: challenge.sacContractId,
    asset: challenge.asset,
    amountI128: challenge.amountI128,
  });

  const res = await fetch("/api/payouts/complete-client", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payoutId: challenge.payoutId,
      stellarTxHash,
      asset: challenge.asset,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Failed to record Pollar payout",
    );
  }
  return {
    payout: data.payout ?? {
      amount: challenge.amount,
      stellarAddress: challenge.destination,
      recipientLabel: challenge.recipientLabel,
      stellarTxHash,
    },
    stellarTxHash,
  };
}
