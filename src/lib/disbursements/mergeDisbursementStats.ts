import type { DisbursementMeta } from "@/lib/disbursements/store";

export type DisbursementListItem = {
  id: string;
  name: string;
  status: string;
  total_payments: number;
  successful_payments: number;
  failed_payments: number;
  total_amount: string;
  disbursed_amount: string;
  asset: { code: string; issuer: string };
  wallet: { id: string; name: string };
  created_at: string;
};

function manualPaymentCount(meta?: DisbursementMeta | null): number {
  return Object.keys(meta?.manualPayments ?? {}).length;
}

function manualDisbursedSum(meta?: DisbursementMeta | null): number {
  let sum = 0;
  for (const row of Object.values(meta?.manualPayments ?? {})) {
    sum += parseFloat(row.amount) || 0;
  }
  return sum;
}

export function isDisbursementArchived(meta?: DisbursementMeta | null): boolean {
  return Boolean(meta?.archivedAt?.trim());
}

export function overlayDisbursementStats<T extends DisbursementListItem>(
  disbursement: T,
  meta?: DisbursementMeta | null
): T {
  const manualCount = manualPaymentCount(meta);
  const manualSum = manualDisbursedSum(meta);
  const sdpSuccess = disbursement.successful_payments;
  const sdpDisbursed = parseFloat(disbursement.disbursed_amount) || 0;

  const successful = Math.max(sdpSuccess, manualCount);
  const disbursed = Math.max(sdpDisbursed, manualSum);
  const total = disbursement.total_payments;
  const allPaid = total > 0 && successful >= total;

  let status = disbursement.status;
  if (allPaid) status = "COMPLETED";
  else if (meta?.archivedAt && status !== "COMPLETED") status = "ARCHIVED";

  return {
    ...disbursement,
    successful_payments: successful,
    disbursed_amount: disbursed.toFixed(7).replace(/\.?0+$/, ""),
    failed_payments: allPaid ? 0 : disbursement.failed_payments,
    status,
  };
}

export function batchRemainingUsdc(
  disbursement: DisbursementListItem,
  meta?: DisbursementMeta | null
): number {
  if (isDisbursementArchived(meta)) return 0;
  const overlaid = overlayDisbursementStats(disbursement, meta);
  if (overlaid.status === "COMPLETED") return 0;
  const total = parseFloat(overlaid.total_amount) || 0;
  const disbursed = parseFloat(overlaid.disbursed_amount) || 0;
  return Math.max(0, total - disbursed);
}

export function isDisbursementFullyPaid(
  disbursement: DisbursementListItem,
  meta?: DisbursementMeta | null
): boolean {
  const overlaid = overlayDisbursementStats(disbursement, meta);
  return (
    overlaid.total_payments > 0 &&
    overlaid.successful_payments >= overlaid.total_payments
  );
}
