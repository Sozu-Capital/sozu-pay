import type { SdpReceiver } from "@/lib/sdp/adminClient";
import { listReceivers } from "@/lib/sdp/adminClient";
import type { DisbursementPaymentRow } from "@/lib/disbursements/mergeDisbursementStats";
import type { ManualPaymentRecord } from "@/lib/disbursements/store";

export function paymentRowsFromReceivers(receivers: SdpReceiver[]): DisbursementPaymentRow[] {
  return paymentRowsFromReceiversWithManual(receivers);
}

export function paymentRowsFromReceiversWithManual(
  receivers: SdpReceiver[],
  manualPayments: Record<string, ManualPaymentRecord> = {}
): DisbursementPaymentRow[] {
  return receivers.map((receiver) => {
    const payment = receiver.payment;
    const paymentId = payment?.id ?? "";
    const manual = paymentId ? manualPayments[paymentId] : undefined;
    if (manual?.txHash) {
      return {
        payment_status: "SUCCESS",
        amount: manual.amount || payment?.amount || "0",
      };
    }
    return {
      payment_status: payment?.status ?? "DRAFT",
      amount: payment?.amount ?? "0",
    };
  });
}

const LIVE_PAYMENT_SYNC_STATUSES = new Set(["STARTED", "PAUSED"]);

export function paymentRowsFromBeneficiaryRows(
  rows: Array<{ payment_status: string; amount: string }>
): DisbursementPaymentRow[] {
  return rows.map((row) => ({
    payment_status: row.payment_status,
    amount: row.amount,
  }));
}

export async function fetchDisbursementPaymentRows(
  disbursementId: string,
  sdpStatus: string,
  manualPayments: Record<string, ManualPaymentRecord> = {}
): Promise<DisbursementPaymentRow[] | undefined> {
  const hasManual = Object.keys(manualPayments).length > 0;
  if (!LIVE_PAYMENT_SYNC_STATUSES.has(sdpStatus.toUpperCase()) && !hasManual) {
    return undefined;
  }
  try {
    const receivers = await listReceivers(disbursementId);
    return paymentRowsFromReceiversWithManual(receivers, manualPayments);
  } catch {
    if (!hasManual) return undefined;
    return Object.values(manualPayments).map((manual) => ({
      payment_status: "SUCCESS",
      amount: manual.amount,
    }));
  }
}
