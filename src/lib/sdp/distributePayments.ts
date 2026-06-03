import "server-only";

import { getDisbursement, listReceivers, retryFailedPayments, startDisbursement } from "@/lib/sdp/adminClient";

export type DistributePaymentsResult = {
  started: boolean;
  alreadyStarted: boolean;
  retried: number;
  registeredPending: number;
  successful: number;
  total: number;
};

/** Start batch if needed, then retry FAILED payments. Pending READY payments are picked up by SDP TSS. */
export async function distributeDisbursementPayments(
  disbursementId: string
): Promise<DistributePaymentsResult> {
  const [disbursement, receivers] = await Promise.all([
    getDisbursement(disbursementId),
    listReceivers(disbursementId),
  ]);

  const current = disbursement.status.toUpperCase();
  let started = false;
  let alreadyStarted = false;

  if (current === "DRAFT" || current === "READY" || current === "PAUSED") {
    await startDisbursement(disbursementId);
    started = true;
  } else if (current === "STARTED") {
    alreadyStarted = true;
  } else {
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
    started,
    alreadyStarted,
    retried: failedIds.length,
    registeredPending,
    successful: disbursement.successful_payments ?? 0,
    total: disbursement.total_payments ?? receivers.length,
  };
}
