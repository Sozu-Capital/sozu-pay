import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { overlayDisbursementStats, isDisbursementFullyPaid } from "@/lib/disbursements/mergeDisbursementStats";
import { normalizeVerificationForSdp } from "@/lib/disbursements/normalizeVerification";

/**
 * Per-disbursement metadata, audit trail, and history archive.
 * Persisted to `.data/disbursement-store.json` so uploaded DOBs survive dev restarts.
 */

export type DisbursementAuditAction =
  | "created"
  | "invites_sent"
  | "payments_started"
  | "hotlink_committed"
  | "hotlink_disabled"
  | "campaign_paused"
  | "campaign_resumed"
  | "recipient_added"
  | "recipient_removed"
  | "recipients_updated"
  | "recipient_name_updated"
  | "recipient_dob_updated"
  | "deleted"
  | "payment_success"
  | "payment_failed"
  | "payment_pending"
  | "campaign_completed";

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
  /** DOB sent in CSV upload (SDP admin API often returns empty after hashing). */
  uploadedVerificationByEmail?: Record<string, string>;
  invitesSentAt?: string;
  invitesSentBy?: string;
  invitesSentByLabel?: string;
  hotlinkAt?: string;
  hotlinkBy?: string;
  hotlinkByLabel?: string;
  paymentsStartedAt?: string;
  paymentsStartedBy?: string;
  paymentsStartedByLabel?: string;
  /** Passkey Soroban payouts recorded locally when SDP TSS has not updated yet. */
  manualPayments?: Record<string, ManualPaymentRecord>;
  archivedAt?: string;
  archiveReason?: "deleted" | "completed" | "closed";
  /** Snapshot for distribution history when SDP batch is gone or file store was reset. */
  archiveSnapshot?: DisbursementHistoryRecord;
  /** SozuPay organization that owns this batch (required for multi-tenant isolation). */
  orgId?: string;
}

export interface ManualPaymentRecord {
  txHash: string;
  amount: string;
  recipientAddress: string;
  paidAt: string;
  paidByLabel?: string;
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
  archive_reason: "deleted" | "completed" | "closed";
  org_id?: string;
  archived_by?: string;
  archived_by_label?: string;
}

const DATA_DIR = join(process.cwd(), ".data");
const STORE_FILE = join(DATA_DIR, "disbursement-store.json");

type PersistedStore = {
  meta: Record<string, DisbursementMeta>;
  audits: Record<string, DisbursementAuditEntry[]>;
  history: DisbursementHistoryRecord[];
};

const metaById = new Map<string, DisbursementMeta>();
const auditById = new Map<string, DisbursementAuditEntry[]>();
const history: DisbursementHistoryRecord[] = [];
const loggedPaymentKeys = new Set<string>();

function loadPersistedStore(): void {
  try {
    if (!existsSync(STORE_FILE)) return;
    const raw = readFileSync(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as PersistedStore;
    for (const [id, meta] of Object.entries(parsed.meta ?? {})) {
      metaById.set(id, meta);
    }
    for (const [id, rows] of Object.entries(parsed.audits ?? {})) {
      auditById.set(id, rows);
    }
    for (const row of parsed.history ?? []) {
      if (!history.some((h) => h.id === row.id && h.archived_at === row.archived_at)) {
        history.push(row);
      }
    }
    history.sort((a, b) => new Date(b.archived_at).getTime() - new Date(a.archived_at).getTime());
  } catch (e) {
    console.warn("[disbursements/store] failed to load persisted store:", e);
  }
}

function persistStore(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const payload: PersistedStore = {
      meta: Object.fromEntries(metaById),
      audits: Object.fromEntries(auditById),
      history,
    };
    writeFileSync(STORE_FILE, JSON.stringify(payload, null, 2), "utf8");
  } catch (e) {
    console.warn("[disbursements/store] failed to persist store:", e);
  }
}

loadPersistedStore();

/** Recover uploaded DOB map from audit when meta was lost (legacy in-memory only). */
export function uploadedVerificationsFromAudit(
  disbursementId: string
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of audits(disbursementId)) {
    const email = entry.metadata?.email?.trim().toLowerCase();
    if (entry.action === "recipient_dob_updated" && email) {
      const dob = entry.metadata?.newValue?.trim();
      if (dob && /^\d{4}-\d{2}-\d{2}$/.test(dob)) out[email] = dob;
    }
    if (entry.action === "created" && entry.metadata?.uploadedVerifications) {
      try {
        const parsed = JSON.parse(entry.metadata.uploadedVerifications) as Record<
          string,
          string
        >;
        for (const [e, dob] of Object.entries(parsed)) {
          const key = e.trim().toLowerCase();
          const iso = dob.trim();
          if (key && /^\d{4}-\d{2}-\d{2}$/.test(iso)) out[key] = iso;
        }
      } catch {
        // ignore malformed audit payload
      }
    }
  }
  return out;
}

export function mergedUploadedVerifications(
  disbursementId: string
): Record<string, string> {
  const meta = getDisbursementMeta(disbursementId)?.uploadedVerificationByEmail ?? {};
  const fromAudit = uploadedVerificationsFromAudit(disbursementId);
  return { ...fromAudit, ...meta };
}

function audits(id: string): DisbursementAuditEntry[] {
  if (!auditById.has(id)) auditById.set(id, []);
  return auditById.get(id)!;
}

function persistMetaToSupabase(meta: DisbursementMeta): void {
  if (!isSupabaseConfigured()) return;
  void import("@/lib/db/disbursement-meta")
    .then(({ upsertDisbursementMeta }) => upsertDisbursementMeta(meta))
    .catch((e) => {
      console.warn("[disbursements/store] Supabase meta persist failed:", e);
    });
}

/** Load meta from memory/DB before mutating — avoids wiping orgId on cold starts. */
export async function loadDisbursementMetaForUpdate(
  disbursementId: string
): Promise<DisbursementMeta> {
  const loaded = await getDisbursementMetaAsync(disbursementId);
  if (loaded) {
    metaById.set(disbursementId, loaded);
    return loaded;
  }
  return ensureDisbursementMeta(disbursementId);
}

function saveDisbursementMeta(meta: DisbursementMeta): void {
  metaById.set(meta.disbursementId, meta);
  persistStore();
  persistMetaToSupabase(meta);
}

/** Re-attach orgId on legacy rows wiped by stale meta upserts. */
export async function repairDisbursementMetaOrgIds(
  metaById: Record<string, DisbursementMeta>,
  orgId: string
): Promise<Record<string, DisbursementMeta>> {
  const { getUserById } = await import("@/lib/db/users");
  const repaired: Record<string, DisbursementMeta> = { ...metaById };

  for (const [disbursementId, meta] of Object.entries(metaById)) {
    if (meta.orgId === orgId) continue;
    if (meta.orgId && meta.orgId !== orgId) continue;
    if (!meta.createdByUserId) continue;

    const creatorId = Number(meta.createdByUserId);
    if (!Number.isFinite(creatorId)) continue;

    const creator = await getUserById(creatorId);
    if (creator?.org_id !== orgId) continue;

    const next = { ...meta, orgId };
    repaired[disbursementId] = next;
    saveDisbursementMeta(next);
  }

  return repaired;
}

function mergeMeta(local: DisbursementMeta | undefined, remote: DisbursementMeta): DisbursementMeta {
  return {
    ...(local ?? { disbursementId: remote.disbursementId, createdAt: remote.createdAt }),
    ...remote,
    uploadedVerificationByEmail: local?.uploadedVerificationByEmail ?? remote.uploadedVerificationByEmail,
    manualPayments: {
      ...(remote.manualPayments ?? {}),
      ...(local?.manualPayments ?? {}),
    },
    archivedAt: local?.archivedAt ?? remote.archivedAt,
    archiveReason: local?.archiveReason ?? remote.archiveReason,
    orgId: local?.orgId ?? remote.orgId,
  };
}

/** Recover invitesSentAt from audit when meta row was lost (legacy in-memory only). */
export function invitesSentAtFromAudit(disbursementId: string): string | undefined {
  for (const entry of getDisbursementAudit(disbursementId)) {
    if (entry.action === "invites_sent") return entry.at;
  }
  return undefined;
}

export async function getDisbursementMetaAsync(
  id: string
): Promise<DisbursementMeta | undefined> {
  const local = metaById.get(id);
  const auditInvitesAt = invitesSentAtFromAudit(id);

  if (!isSupabaseConfigured()) {
    if (!local && !auditInvitesAt) return undefined;
    return {
      disbursementId: id,
      createdAt: local?.createdAt ?? auditInvitesAt ?? new Date().toISOString(),
      ...local,
      invitesSentAt: local?.invitesSentAt ?? auditInvitesAt,
    };
  }

  try {
    const { fetchDisbursementMeta } = await import("@/lib/db/disbursement-meta");
    const fromDb = await fetchDisbursementMeta(id);
    if (!fromDb && !local && !auditInvitesAt) return undefined;

    const merged = fromDb
      ? mergeMeta(local, fromDb)
      : {
          disbursementId: id,
          createdAt: local?.createdAt ?? auditInvitesAt ?? new Date().toISOString(),
          ...local,
        };

    if (!merged.invitesSentAt && auditInvitesAt) {
      merged.invitesSentAt = auditInvitesAt;
      persistMetaToSupabase(merged);
    }

    return merged;
  } catch (e) {
    console.warn("[disbursements/store] Supabase meta load failed:", e);
    if (!local && !auditInvitesAt) return undefined;
    return {
      disbursementId: id,
      createdAt: local?.createdAt ?? auditInvitesAt ?? new Date().toISOString(),
      ...local,
      invitesSentAt: local?.invitesSentAt ?? auditInvitesAt,
    };
  }
}

export async function getAllDisbursementMetaAsync(): Promise<Record<string, DisbursementMeta>> {
  const local = Object.fromEntries(metaById);
  if (!isSupabaseConfigured()) {
    const out = { ...local };
    for (const id of Object.keys(out)) {
      if (!out[id].invitesSentAt) {
        const fromAudit = invitesSentAtFromAudit(id);
        if (fromAudit) out[id] = { ...out[id], invitesSentAt: fromAudit };
      }
    }
    return out;
  }

  try {
    const { fetchAllDisbursementMeta } = await import("@/lib/db/disbursement-meta");
    const fromDb = await fetchAllDisbursementMeta();
    const merged: Record<string, DisbursementMeta> = { ...local };

    for (const [id, dbMeta] of Object.entries(fromDb)) {
      merged[id] = mergeMeta(local[id], dbMeta);
    }

    for (const id of new Set([...Object.keys(local), ...Object.keys(fromDb)])) {
      const meta = merged[id];
      if (meta && !meta.invitesSentAt) {
        const fromAudit = invitesSentAtFromAudit(id);
        if (fromAudit) {
          merged[id] = { ...meta, invitesSentAt: fromAudit };
          persistMetaToSupabase(merged[id]);
        }
      }
    }

    return merged;
  } catch (e) {
    console.warn("[disbursements/store] Supabase meta load-all failed:", e);
    return local;
  }
}

export function getDisbursementMeta(id: string): DisbursementMeta | undefined {
  return metaById.get(id);
}

export function getAllDisbursementMeta(): Record<string, DisbursementMeta> {
  return Object.fromEntries(metaById);
}

/** Merge DOB values we uploaded to SDP (key = lowercased email). */
export function recordUploadedVerifications(
  disbursementId: string,
  byEmail: Record<string, string>
): void {
  const meta = ensureDisbursementMeta(disbursementId);
  const prev = meta.uploadedVerificationByEmail ?? {};
  const next: Record<string, string> = { ...prev };
  for (const [email, dob] of Object.entries(byEmail)) {
    const key = email.trim().toLowerCase();
    const iso = normalizeVerificationForSdp(dob) ?? dob.trim();
    if (key && iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) next[key] = iso;
  }
  meta.uploadedVerificationByEmail = next;
  persistStore();
  void import("@/lib/db/disbursement-verifications")
    .then(({ upsertDisbursementVerifications }) =>
      upsertDisbursementVerifications(disbursementId, next)
    )
    .catch((e) => {
      console.warn("[disbursements/store] Supabase DOB persist failed:", e);
    });
}

/** Merge file/audit meta with Supabase (production). */
export async function mergedUploadedVerificationsAsync(
  disbursementId: string
): Promise<Record<string, string>> {
  const local = mergedUploadedVerifications(disbursementId);
  try {
    const { fetchDisbursementVerifications } = await import(
      "@/lib/db/disbursement-verifications"
    );
    const fromDb = await fetchDisbursementVerifications(disbursementId);
    return { ...fromDb, ...local };
  } catch (e) {
    console.warn("[disbursements/store] Supabase DOB load failed:", e);
    return local;
  }
}

export function getUploadedVerificationForEmail(
  disbursementId: string,
  email: string
): string | undefined {
  const key = email.trim().toLowerCase();
  return mergedUploadedVerifications(disbursementId)[key];
}

export function ensureDisbursementMeta(
  id: string,
  init?: Partial<
    Pick<DisbursementMeta, "createdByUserId" | "createdByLabel" | "orgId">
  >
): DisbursementMeta {
  const existing = metaById.get(id);
  if (existing) {
    if (init?.orgId && !existing.orgId) {
      existing.orgId = init.orgId;
      persistStore();
      persistMetaToSupabase(existing);
    }
    return existing;
  }
  const meta: DisbursementMeta = {
    disbursementId: id,
    createdAt: new Date().toISOString(),
    createdByUserId: init?.createdByUserId,
    createdByLabel: init?.createdByLabel,
    orgId: init?.orgId,
  };
  metaById.set(id, meta);
  persistStore();
  persistMetaToSupabase(meta);
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
  persistStore();
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
  void markInvitesSentAsync(disbursementId, actor, summary);
}

export async function markInvitesSentAsync(
  disbursementId: string,
  actor: { userId: string; label: string },
  summary: { sent: number; skipped: number; failed: number }
): Promise<void> {
  const meta = await loadDisbursementMetaForUpdate(disbursementId);
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
  saveDisbursementMeta(meta);
}

export async function recordManualDisbursementPaymentAsync(
  disbursementId: string,
  actor: { userId: string; label: string },
  payment: {
    paymentId: string;
    txHash: string;
    amount: string;
    recipientAddress: string;
    recipientLabel: string;
  }
): Promise<void> {
  const meta = await loadDisbursementMetaForUpdate(disbursementId);
  if (!meta.manualPayments) meta.manualPayments = {};
  meta.manualPayments[payment.paymentId] = {
    txHash: payment.txHash,
    amount: payment.amount,
    recipientAddress: payment.recipientAddress,
    paidAt: new Date().toISOString(),
    paidByLabel: actor.label,
  };
  appendDisbursementAudit(disbursementId, {
    action: "payment_success",
    actorUserId: actor.userId,
    actorLabel: actor.label,
    message: `Manual payout ${payment.amount} USDC to ${payment.recipientLabel}`,
    metadata: {
      paymentId: payment.paymentId,
      txHash: payment.txHash,
      amount: payment.amount,
      recipientAddress: payment.recipientAddress,
    },
  });
  saveDisbursementMeta(meta);
}

export function recordManualDisbursementPayment(
  disbursementId: string,
  actor: { userId: string; label: string },
  payment: {
    paymentId: string;
    txHash: string;
    amount: string;
    recipientAddress: string;
    recipientLabel: string;
  }
): void {
  void recordManualDisbursementPaymentAsync(disbursementId, actor, payment);
}

export function maybeArchiveCompletedDisbursement(
  disbursement: {
    id: string;
    name: string;
    status: string;
    total_payments: number;
    successful_payments: number;
    failed_payments: number;
    total_amount: string;
    disbursed_amount: string;
    asset: { code: string; issuer?: string };
    wallet: { name: string; id?: string };
    created_at: string;
  },
  meta?: DisbursementMeta | null
): void {
  archiveCompletedIfNeeded({
    disbursement: overlayDisbursementStats(
      {
        ...disbursement,
        asset: { code: disbursement.asset.code, issuer: disbursement.asset.issuer ?? "" },
        wallet: { id: disbursement.wallet.id ?? "", name: disbursement.wallet.name },
      },
      meta ?? undefined
    ),
  });
}

export function markHotlinkCommitted(
  disbursementId: string,
  actor: { userId: string; label: string }
): void {
  void markHotlinkCommittedAsync(disbursementId, actor);
}

export async function markHotlinkCommittedAsync(
  disbursementId: string,
  actor: { userId: string; label: string }
): Promise<void> {
  const meta = await loadDisbursementMetaForUpdate(disbursementId);
  meta.hotlinkAt = new Date().toISOString();
  meta.hotlinkBy = actor.userId;
  meta.hotlinkByLabel = actor.label;
  appendDisbursementAudit(disbursementId, {
    action: "hotlink_committed",
    actorUserId: actor.userId,
    actorLabel: actor.label,
    message: "Auto pay enabled — SDP releases funds when beneficiaries finish registration",
  });
  saveDisbursementMeta(meta);
}

export function clearHotlinkCommitted(
  disbursementId: string,
  actor: { userId: string; label: string }
): void {
  void clearHotlinkCommittedAsync(disbursementId, actor);
}

export async function clearHotlinkCommittedAsync(
  disbursementId: string,
  actor: { userId: string; label: string }
): Promise<void> {
  const meta = await loadDisbursementMetaForUpdate(disbursementId);
  delete meta.hotlinkAt;
  delete meta.hotlinkBy;
  delete meta.hotlinkByLabel;
  appendDisbursementAudit(disbursementId, {
    action: "hotlink_disabled",
    actorUserId: actor.userId,
    actorLabel: actor.label,
    message: "Auto pay disabled — use Distribuir to release payments manually",
  });
  saveDisbursementMeta(meta);
}

export function markPaymentsStarted(
  disbursementId: string,
  actor: { userId: string; label: string },
  batchName: string
): void {
  void markPaymentsStartedAsync(disbursementId, actor, batchName);
}

export async function markPaymentsStartedAsync(
  disbursementId: string,
  actor: { userId: string; label: string },
  batchName: string
): Promise<void> {
  const meta = await loadDisbursementMetaForUpdate(disbursementId);
  meta.paymentsStartedAt = new Date().toISOString();
  meta.paymentsStartedBy = actor.userId;
  meta.paymentsStartedByLabel = actor.label;
  appendDisbursementAudit(disbursementId, {
    action: "payments_started",
    actorUserId: actor.userId,
    actorLabel: actor.label,
    message: `Payments started for batch "${batchName}"`,
  });
  saveDisbursementMeta(meta);
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
  sdpDeleted?: boolean;
}): void {
  void archiveDeletedDisbursementAsync(params);
}

export async function archiveDeletedDisbursementAsync(params: {
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
  sdpDeleted?: boolean;
}): Promise<void> {
  const { disbursement, actor, sdpDeleted = false } = params;
  const meta = await loadDisbursementMetaForUpdate(disbursement.id);
  meta.archivedAt = new Date().toISOString();
  meta.archiveReason = "deleted";
  delete meta.hotlinkAt;
  delete meta.hotlinkBy;
  delete meta.hotlinkByLabel;

  appendDisbursementAudit(disbursement.id, {
    action: "deleted",
    actorUserId: actor.userId,
    actorLabel: actor.label,
    message: sdpDeleted
      ? `Batch "${disbursement.name}" deleted`
      : `Batch "${disbursement.name}" archived (removed from active list)`,
  });

  if (!history.some((h) => h.id === disbursement.id && h.archive_reason === "deleted")) {
    const snapshot: DisbursementHistoryRecord = {
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
      archived_at: meta.archivedAt,
      archive_reason: "deleted",
      org_id: meta.orgId,
      archived_by: actor.userId,
      archived_by_label: actor.label,
    };
    history.unshift(snapshot);
    meta.archiveSnapshot = snapshot;
  }

  persistStore();
  saveDisbursementMeta(meta);
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
  void archiveCompletedIfNeededAsync(params);
}

export async function archiveCompletedIfNeededAsync(_params: {
  disbursement: {
    id: string;
    name: string;
    status: string;
    total_payments: number;
    successful_payments: number;
    failed_payments: number;
    total_amount: string;
    disbursed_amount: string;
    asset: { code: string; issuer?: string };
    wallet: { name: string; id?: string };
    created_at: string;
  };
}): Promise<void> {
  // Completed batches stay on the active list until an admin archives them manually.
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
