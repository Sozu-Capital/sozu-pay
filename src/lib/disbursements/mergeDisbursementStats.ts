import type { DisbursementMeta } from "@/lib/disbursements/store";

export type DisbursementPaymentRow = {
  payment_status: string;
  amount: string;
};

export type OverlayDisbursementOptions = {
  paymentRows?: DisbursementPaymentRow[];
};

const SUCCESS_PAYMENT_STATUSES = new Set(["SUCCESS", "PAID"]);
const FAILED_PAYMENT_STATUSES = new Set(["FAILED"]);

export function derivePaymentStatsFromRows(rows: DisbursementPaymentRow[]): {
  successful: number;
  failed: number;
  disbursed: number;
} {
  let successful = 0;
  let failed = 0;
  let disbursed = 0;

  for (const row of rows) {
    const status = row.payment_status.toUpperCase();
    const amt = parseFloat(String(row.amount).replace(/[^0-9.-]/g, "")) || 0;
    if (SUCCESS_PAYMENT_STATUSES.has(status)) {
      successful += 1;
      disbursed += amt;
    } else if (FAILED_PAYMENT_STATUSES.has(status)) {
      failed += 1;
    }
  }

  return { successful, failed, disbursed };
}

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
  meta?: DisbursementMeta | null,
  options?: OverlayDisbursementOptions
): T {
  const manualCount = manualPaymentCount(meta);
  const manualSum = manualDisbursedSum(meta);
  const rowStats = options?.paymentRows?.length
    ? derivePaymentStatsFromRows(options.paymentRows)
    : { successful: 0, failed: 0, disbursed: 0 };
  const sdpSuccess = disbursement.successful_payments;
  const sdpDisbursed = parseFloat(disbursement.disbursed_amount) || 0;

  const successful = Math.max(sdpSuccess, manualCount, rowStats.successful);
  const disbursed = Math.max(sdpDisbursed, manualSum, rowStats.disbursed);
  const failed = Math.max(disbursement.failed_payments, rowStats.failed);
  const total = disbursement.total_payments;
  const totalAmount = parseFloat(disbursement.total_amount) || 0;
  const allPaid =
    total > 0 &&
    successful >= total &&
    (totalAmount <= 0 || disbursed + 1e-9 >= totalAmount);

  let status = disbursement.status;
  if (allPaid) status = "COMPLETED";
  else if (meta?.archivedAt && status !== "COMPLETED") status = "ARCHIVED";

  return {
    ...disbursement,
    successful_payments: successful,
    disbursed_amount: disbursed.toFixed(7).replace(/\.?0+$/, ""),
    failed_payments: allPaid ? 0 : failed,
    status,
  };
}

export function batchRemainingUsdc(
  disbursement: DisbursementListItem,
  meta?: DisbursementMeta | null,
  options?: OverlayDisbursementOptions
): number {
  if (isDisbursementArchived(meta)) return 0;
  const overlaid = overlayDisbursementStats(disbursement, meta, options);
  if (overlaid.status === "COMPLETED") return 0;
  const total = parseFloat(overlaid.total_amount) || 0;
  const disbursed = parseFloat(overlaid.disbursed_amount) || 0;
  return Math.max(0, total - disbursed);
}

export function isDisbursementFullyPaid(
  disbursement: DisbursementListItem,
  meta?: DisbursementMeta | null,
  options?: OverlayDisbursementOptions
): boolean {
  const overlaid = overlayDisbursementStats(disbursement, meta, options);
  return overlaid.status === "COMPLETED";
}

const LIVE_CAMPAIGN_STATUSES = new Set(["DRAFT", "READY", "STARTED", "PAUSED"]);

/** Whether a batch should appear on the active Disbursements page (not History). */
export function isActiveDisbursementCampaign(
  disbursement: DisbursementListItem,
  meta?: DisbursementMeta | null,
  options?: OverlayDisbursementOptions
): boolean {
  if (isDisbursementArchived(meta)) return false;

  const overlaid = overlayDisbursementStats(disbursement, meta, options);
  if (overlaid.status === "COMPLETED") return true;

  const sdpStatus = disbursement.status.toUpperCase();
  if (LIVE_CAMPAIGN_STATUSES.has(sdpStatus)) return true;
  if (LIVE_CAMPAIGN_STATUSES.has(overlaid.status.toUpperCase())) return true;

  const total = parseFloat(overlaid.total_amount) || 0;
  const disbursed = parseFloat(overlaid.disbursed_amount) || 0;
  if (total > 0 && disbursed + 1e-9 < total) return true;

  return overlaid.successful_payments < overlaid.total_payments;
}
