import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Per-disbursement metadata, audit trail, and history archive.
 * Persisted to `.data/disbursement-store.json` so uploaded DOBs survive dev restarts.
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

const DATA_DIR = join(process.cwd(), ".data");
const STORE_FILE = join(DATA_DIR, "disbursement-store.json");

type PersistedStore = {
  meta: Record<string, DisbursementMeta>;
  audits: Record<string, DisbursementAuditEntry[]>;
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

function mergeMeta(local: DisbursementMeta | undefined, remote: DisbursementMeta): DisbursementMeta {
  return {
    ...(local ?? { disbursementId: remote.disbursementId, createdAt: remote.createdAt }),
    ...remote,
    uploadedVerificationByEmail: local?.uploadedVerificationByEmail ?? remote.uploadedVerificationByEmail,
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
    const iso = dob.trim();
    if (key && iso) next[key] = iso;
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
  persistMetaToSupabase(meta);
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
  persistMetaToSupabase(meta);
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
  persistMetaToSupabase(meta);
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
  persistStore();
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
