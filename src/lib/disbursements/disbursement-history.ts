import "server-only";

import type { SdpDisbursement } from "@/lib/sdp/adminClient";
import {
  getDisbursementHistory,
  type DisbursementHistoryRecord,
  type DisbursementMeta,
} from "@/lib/disbursements/store";
import {
  isDisbursementFullyPaid,
  overlayDisbursementStats,
} from "@/lib/disbursements/mergeDisbursementStats";

export type ArchiveReason = DisbursementHistoryRecord["archive_reason"];

function historyKey(id: string, reason: ArchiveReason): string {
  return `${id}:${reason}`;
}

function recordFromSdpAndMeta(
  disbursement: SdpDisbursement,
  meta: DisbursementMeta,
  orgId: string
): DisbursementHistoryRecord {
  const overlaid = overlayDisbursementStats(disbursement, meta);
  const reason: ArchiveReason =
    meta.archiveReason === "deleted"
      ? "deleted"
      : meta.archiveReason === "closed"
        ? "closed"
        : overlaid.failed_payments > 0 && !isDisbursementFullyPaid(overlaid, meta)
          ? "closed"
          : "completed";

  return {
    id: disbursement.id,
    name: disbursement.name,
    status: overlaid.status,
    total_payments: overlaid.total_payments,
    successful_payments: overlaid.successful_payments,
    failed_payments: overlaid.failed_payments,
    total_amount: overlaid.total_amount,
    disbursed_amount: overlaid.disbursed_amount,
    asset_code: disbursement.asset?.code ?? "USDC",
    wallet_name: disbursement.wallet?.name ?? "",
    created_at: disbursement.created_at,
    archived_at: meta.archivedAt!,
    archive_reason: reason,
    org_id: orgId,
    archived_by: meta.invitesSentBy ?? meta.paymentsStartedBy,
    archived_by_label: meta.invitesSentByLabel ?? meta.paymentsStartedByLabel,
  };
}

/**
 * Merge file-backed history with Supabase meta (archived_at) so production audits survive serverless restarts.
 */
export function buildOrgDisbursementHistory(params: {
  orgId: string;
  disbursements: SdpDisbursement[];
  metaById: Record<string, DisbursementMeta>;
}): DisbursementHistoryRecord[] {
  const { orgId, disbursements, metaById } = params;
  const byKey = new Map<string, DisbursementHistoryRecord>();

  for (const row of getDisbursementHistory()) {
    const meta = metaById[row.id];
    const rowOrgId = row.org_id ?? meta?.orgId;
    if (rowOrgId !== orgId) continue;
    byKey.set(historyKey(row.id, row.archive_reason), {
      ...row,
      org_id: orgId,
    });
  }

  for (const [id, meta] of Object.entries(metaById)) {
    if (meta.orgId !== orgId || !meta.archivedAt?.trim()) continue;
    const sdp = disbursements.find((d) => d.id === id);
    if (sdp) {
      const synthesized = recordFromSdpAndMeta(sdp, meta, orgId);
      const key = historyKey(id, synthesized.archive_reason);
      const existing = byKey.get(key);
      if (!existing || existing.archived_at < synthesized.archived_at) {
        byKey.set(key, { ...synthesized, ...existing, ...synthesized });
      }
      continue;
    }

    if (meta.archiveSnapshot) {
      const snapshot = { ...meta.archiveSnapshot, org_id: orgId };
      const key = historyKey(id, snapshot.archive_reason);
      const existing = byKey.get(key);
      if (!existing || existing.archived_at < snapshot.archived_at) {
        byKey.set(key, { ...existing, ...snapshot });
      }
    }
  }

  return [...byKey.values()].sort(
    (a, b) => new Date(b.archived_at).getTime() - new Date(a.archived_at).getTime()
  );
}

export function findOrgHistoryRecord(
  orgId: string,
  disbursementId: string,
  metaById?: Record<string, DisbursementMeta>
): DisbursementHistoryRecord | undefined {
  const meta = metaById?.[disbursementId];
  for (const row of getDisbursementHistory()) {
    if (row.id !== disbursementId) continue;
    const rowOrgId = row.org_id ?? meta?.orgId;
    if (rowOrgId === orgId) return { ...row, org_id: orgId };
  }
  if (meta?.orgId === orgId && meta.archiveSnapshot) {
    return { ...meta.archiveSnapshot, org_id: orgId };
  }
  return undefined;
}
