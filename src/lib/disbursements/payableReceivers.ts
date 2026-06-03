import type { SdpReceiver } from "@/lib/sdp/adminClient";
import type { ManualPaymentRecord } from "@/lib/disbursements/store";
import { externalIdAsBeneficiaryName, externalIdToDisplayName } from "@/lib/sdp/receiverDisplay";

export type PayableDisbursementItem = {
  paymentId: string;
  amount: string;
  recipientAddress: string;
  recipientLabel: string;
  receiverEmail?: string;
};

export function listPayableDisbursementReceivers(
  receivers: SdpReceiver[],
  manualPayments: Record<string, ManualPaymentRecord> = {}
): PayableDisbursementItem[] {
  const out: PayableDisbursementItem[] = [];

  for (const receiver of receivers) {
    const payment = receiver.payment;
    const wallet = receiver.receiver_wallet;
    const address = wallet?.stellar_address?.trim();
    if (!payment?.id || !address) continue;
    if (manualPayments[payment.id]?.txHash) continue;

    const paymentStatus = payment.status?.toUpperCase() ?? "DRAFT";
    if (paymentStatus === "SUCCESS" || paymentStatus === "CANCELED") continue;
    if (payment.stellar_transaction_id?.trim()) continue;

    const walletStatus = wallet?.status?.toUpperCase() ?? "";
    if (walletStatus !== "REGISTERED") continue;

    const label =
      externalIdAsBeneficiaryName(receiver.external_id ?? "") ??
      (externalIdToDisplayName(receiver.external_id ?? "") ||
        receiver.email?.split("@")[0] ||
        "Beneficiary");

    out.push({
      paymentId: payment.id,
      amount: payment.amount,
      recipientAddress: address,
      recipientLabel: label,
      receiverEmail: receiver.email,
    });
  }

  return out;
}

export function applyManualPaymentsToBeneficiaryRows<
  T extends {
    id: string;
    payment_status: string;
    lifecycle_state: string;
    stellar_transaction_id: string | null;
  },
>(rows: T[], manualPayments: Record<string, ManualPaymentRecord> = {}): T[] {
  return rows.map((row) => {
    const manual = manualPayments[row.id];
    if (!manual?.txHash) return row;
    return {
      ...row,
      payment_status: "SUCCESS",
      lifecycle_state: "sent",
      stellar_transaction_id: manual.txHash,
    };
  });
}
