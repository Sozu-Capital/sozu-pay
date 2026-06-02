/**
 * Per-disbursement metadata, audit trail, and history archive.
 * In-memory per process (same pattern as lib/audit.ts). Move to DB for production.
 */

export type DisbursementAuditAction =
  | "created"
  | "invites_sent"
  | "payments_started"
  | "hotlink_committed"
  | "recipient_added"
  | "recipient_removed"
  | "recipients_updated"
  | "recipient_name_updated"
  | "recipient_dob_updated"
  | "deleted"
  | "payment_success"
  | "payment_failed"
  | "payment_pending";

export interface DisbursementAuditEntry {
  id: string;
  at: string;
  action: DisbursementAuditAction;
  actorUserId: string;
  actorLabel: string;
  message: string;
  metadata?: Record<string, string>;
}

export interface DisbursementMeta {
  disbursementId: string;
  createdAt: string;
  createdByUserId?: string;
  createdByLabel?: string;
  invitesSentAt?: string;
  invitesSentBy?: string;
  invitesSentByLabel?: string;
  hotlinkAt?: string;
  hotlinkBy?: string;
  hotlinkByLabel?: string;
  paymentsStartedAt?: string;
  paymentsStartedBy?: string;
  paymentsStartedByLabel?: string;
}

export interface DisbursementHistoryRecord {
  id: string;
  name: string;
  status: string;
  total_payments: number;
  successful_payments: number;
  failed_payments: number;
  total_amount: string;
  disbursed_amount: string;
  asset_code: string;
  wallet_name: string;
  created_at: string;
  archived_at: string;
  archive_reason: "deleted" | "completed";
  archived_by?: string;
  archived_by_label?: string;
}

const metaById = new Map<string, DisbursementMeta>();
const auditById = new Map<string, DisbursementAuditEntry[]>();
const history: DisbursementHistoryRecord[] = [];
const loggedPaymentKeys = new Set<string>();

function audits(id: string): DisbursementAuditEntry[] {
  if (!auditById.has(id)) auditById.set(id, []);
  return auditById.get(id)!;
}

export function getDisbursementMeta(id: string): DisbursementMeta | undefined {
  return metaById.get(id);
}

export function getAllDisbursementMeta(): Record<string, DisbursementMeta> {
  return Object.fromEntries(metaById);
}

export function ensureDisbursementMeta(
  id: string,
  init?: Partial<Pick<DisbursementMeta, "createdByUserId" | "createdByLabel">>
): DisbursementMeta {
  const existing = metaById.get(id);
  if (existing) return existing;
  const meta: DisbursementMeta = {
    disbursementId: id,
    createdAt: new Date().toISOString(),
    createdByUserId: init?.createdByUserId,
    createdByLabel: init?.createdByLabel,
  };
  metaById.set(id, meta);
  return meta;
}

export function appendDisbursementAudit(
  disbursementId: string,
  entry: Omit<DisbursementAuditEntry, "id" | "at">
): DisbursementAuditEntry {
  const row: DisbursementAuditEntry = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    ...entry,
  };
  audits(disbursementId).push(row);
  return row;
}

export function getDisbursementAudit(disbursementId: string): DisbursementAuditEntry[] {
  return [...audits(disbursementId)].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  );
}

export function markInvitesSent(
  disbursementId: string,
  actor: { userId: string; label: string },
  summary: { sent: number; skipped: number; failed: number }
): void {
  const meta = ensureDisbursementMeta(disbursementId);
  meta.invitesSentAt = new Date().toISOString();
  meta.invitesSentBy = actor.userId;
  meta.invitesSentByLabel = actor.label;
  appendDisbursementAudit(disbursementId, {
    action: "invites_sent",
    actorUserId: actor.userId,
    actorLabel: actor.label,
    message: `Invite emails sent (${summary.sent} sent, ${summary.skipped} skipped, ${summary.failed} failed)`,
    metadata: {
      sent: String(summary.sent),
      skipped: String(summary.skipped),
      failed: String(summary.failed),
    },
  });
}

export function markHotlinkCommitted(
  disbursementId: string,
  actor: { userId: string; label: string }
): void {
  const meta = ensureDisbursementMeta(disbursementId);
  meta.hotlinkAt = new Date().toISOString();
  meta.hotlinkBy = actor.userId;
  meta.hotlinkByLabel = actor.label;
  appendDisbursementAudit(disbursementId, {
    action: "hotlink_committed",
    actorUserId: actor.userId,
    actorLabel: actor.label,
    message: "Hotlink enabled — recipients can claim funds without further NGO approval",
  });
}

export function markPaymentsStarted(
  disbursementId: string,
  actor: { userId: string; label: string },
  batchName: string
): void {
  const meta = ensureDisbursementMeta(disbursementId);
  meta.paymentsStartedAt = new Date().toISOString();
  meta.paymentsStartedBy = actor.userId;
  meta.paymentsStartedByLabel = actor.label;
  appendDisbursementAudit(disbursementId, {
    action: "payments_started",
    actorUserId: actor.userId,
    actorLabel: actor.label,
    message: `Payments started for batch "${batchName}"`,
  });
}

export function archiveDeletedDisbursement(params: {
  disbursement: {
    id: string;
    name: string;
    status: string;
    total_payments: number;
    successful_payments: number;
    failed_payments: number;
    total_amount: string;
    disbursed_amount: string;
    asset: { code: string };
    wallet: { name: string };
    created_at: string;
  };
  actor: { userId: string; label: string };
}): void {
  const { disbursement, actor } = params;
  appendDisbursementAudit(disbursement.id, {
    action: "deleted",
    actorUserId: actor.userId,
    actorLabel: actor.label,
    message: `Batch "${disbursement.name}" deleted`,
  });
  history.unshift({
    id: disbursement.id,
    name: disbursement.name,
    status: disbursement.status,
    total_payments: disbursement.total_payments,
    successful_payments: disbursement.successful_payments,
    failed_payments: disbursement.failed_payments,
    total_amount: disbursement.total_amount,
    disbursed_amount: disbursement.disbursed_amount,
    asset_code: disbursement.asset.code,
    wallet_name: disbursement.wallet.name,
    created_at: disbursement.created_at,
    archived_at: new Date().toISOString(),
    archive_reason: "deleted",
    archived_by: actor.userId,
    archived_by_label: actor.label,
  });
  metaById.delete(disbursement.id);
  auditById.delete(disbursement.id);
}

export function archiveCompletedIfNeeded(params: {
  disbursement: {
    id: string;
    name: string;
    status: string;
    total_payments: number;
    successful_payments: number;
    failed_payments: number;
    total_amount: string;
    disbursed_amount: string;
    asset: { code: string };
    wallet: { name: string };
    created_at: string;
  };
}): void {
  const { disbursement } = params;
  if (disbursement.status !== "COMPLETED") return;
  if (history.some((h) => h.id === disbursement.id && h.archive_reason === "completed")) return;
  history.unshift({
    id: disbursement.id,
    name: disbursement.name,
    status: disbursement.status,
    total_payments: disbursement.total_payments,
    successful_payments: disbursement.successful_payments,
    failed_payments: disbursement.failed_payments,
    total_amount: disbursement.total_amount,
    disbursed_amount: disbursement.disbursed_amount,
    asset_code: disbursement.asset.code,
    wallet_name: disbursement.wallet.name,
    created_at: disbursement.created_at,
    archived_at: new Date().toISOString(),
    archive_reason: "completed",
  });
}

export function getDisbursementHistory(): DisbursementHistoryRecord[] {
  return [...history];
}

/** Record payment lifecycle transitions once (for audit modal). */
export function syncPaymentAuditEvents(
  disbursementId: string,
  payments: Array<{
    id: string;
    beneficiary_name: string;
    payment_status: string;
    stellar_transaction_id: string | null;
  }>
): void {
  for (const p of payments) {
    const key = `${disbursementId}:${p.id}:${p.payment_status}:${p.stellar_transaction_id ?? ""}`;
    if (loggedPaymentKeys.has(key)) continue;
    if (p.payment_status === "SUCCESS" && p.stellar_transaction_id) {
      loggedPaymentKeys.add(key);
      appendDisbursementAudit(disbursementId, {
        action: "payment_success",
        actorUserId: "system",
        actorLabel: "Recipient",
        message: `${p.beneficiary_name} received funds`,
        metadata: {
          paymentId: p.id,
          txHash: p.stellar_transaction_id,
        },
      });
    } else if (p.payment_status === "FAILED") {
      loggedPaymentKeys.add(key);
      appendDisbursementAudit(disbursementId, {
        action: "payment_failed",
        actorUserId: "system",
        actorLabel: "System",
        message: `Payment failed for ${p.beneficiary_name}`,
        metadata: { paymentId: p.id },
      });
    }
  }
}

export function actorLabelFromUser(user: {
  email?: string | null;
  username?: string | null;
  id?: number | string;
}): string {
  if (user.username?.trim()) return `$${user.username.replace(/^\$/, "")}`;
  if (user.email?.trim()) return user.email.trim();
  return String(user.id ?? "Unknown");
}
