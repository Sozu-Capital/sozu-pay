import "server-only";

import { getDisbursement, listReceivers, retryFailedPayments } from "@/lib/sdp/adminClient";

export type DistributePaymentsResult = {
  started: boolean;
  alreadyStarted: boolean;
  retried: number;
  registeredPending: number;
  successful: number;
  total: number;
};

/**
 * Retry FAILED SDP payments when batch is already STARTED.
 * Passkey Soroban payouts (Distribuir) do not use SDP TSS or the Railway distribution account.
 */
export async function distributeDisbursementPayments(
  disbursementId: string
): Promise<DistributePaymentsResult> {
  const [disbursement, receivers] = await Promise.all([
    getDisbursement(disbursementId),
    listReceivers(disbursementId),
  ]);

  const current = disbursement.status.toUpperCase();
  const alreadyStarted = current === "STARTED";
  if (current !== "STARTED" && current !== "DRAFT" && current !== "READY" && current !== "PAUSED") {
    throw new Error(`Cannot distribute payments while batch status is ${current}.`);
  }

  const failedIds = receivers
    .map((r) => r.payment)
    .filter((p) => p && p.status?.toUpperCase() === "FAILED")
    .map((p) => p!.id);

  const registeredPending = receivers.filter((r) => {
    const paymentStatus = r.payment?.status?.toUpperCase() ?? "";
    const walletStatus = r.receiver_wallet?.status?.toUpperCase() ?? "";
    return (
      walletStatus === "REGISTERED" &&
      paymentStatus !== "SUCCESS" &&
      paymentStatus !== "FAILED" &&
      paymentStatus !== "CANCELED"
    );
  }).length;

  if (failedIds.length > 0) {
    await retryFailedPayments(failedIds);
  }

  return {
    started: false,
    alreadyStarted,
    retried: failedIds.length,
    registeredPending,
    successful: disbursement.successful_payments ?? 0,
    total: disbursement.total_payments ?? receivers.length,
  };
}
