import type { SdpReceiver } from "@/lib/sdp/adminClient";
import { listReceivers } from "@/lib/sdp/adminClient";
import type { DisbursementPaymentRow } from "@/lib/disbursements/mergeDisbursementStats";

export function paymentRowsFromReceivers(receivers: SdpReceiver[]): DisbursementPaymentRow[] {
  return receivers.map((receiver) => ({
    payment_status: receiver.payment?.status ?? "DRAFT",
    amount: receiver.payment?.amount ?? "0",
  }));
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
  sdpStatus: string
): Promise<DisbursementPaymentRow[] | undefined> {
  if (!LIVE_PAYMENT_SYNC_STATUSES.has(sdpStatus.toUpperCase())) return undefined;
  try {
    const receivers = await listReceivers(disbursementId);
    return paymentRowsFromReceivers(receivers);
  } catch {
    return undefined;
  }
}
