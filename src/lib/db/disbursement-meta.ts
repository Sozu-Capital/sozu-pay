import { getSupabase } from "@/lib/supabase/server";
import type { DisbursementMeta } from "@/lib/disbursements/store";

type MetaRow = {
  disbursement_id: string;
  created_at: string | null;
  created_by_user_id: string | null;
  created_by_label: string | null;
  invites_sent_at: string | null;
  invites_sent_by: string | null;
  invites_sent_by_label: string | null;
  hotlink_at: string | null;
  hotlink_by: string | null;
  hotlink_by_label: string | null;
  payments_started_at: string | null;
  payments_started_by: string | null;
  payments_started_by_label: string | null;
};

function rowToMeta(row: MetaRow): DisbursementMeta {
  return {
    disbursementId: row.disbursement_id,
    createdAt: row.created_at ?? new Date().toISOString(),
    createdByUserId: row.created_by_user_id ?? undefined,
    createdByLabel: row.created_by_label ?? undefined,
    invitesSentAt: row.invites_sent_at ?? undefined,
    invitesSentBy: row.invites_sent_by ?? undefined,
    invitesSentByLabel: row.invites_sent_by_label ?? undefined,
    hotlinkAt: row.hotlink_at ?? undefined,
    hotlinkBy: row.hotlink_by ?? undefined,
    hotlinkByLabel: row.hotlink_by_label ?? undefined,
    paymentsStartedAt: row.payments_started_at ?? undefined,
    paymentsStartedBy: row.payments_started_by ?? undefined,
    paymentsStartedByLabel: row.payments_started_by_label ?? undefined,
  };
}

function metaToRow(meta: DisbursementMeta): MetaRow {
  return {
    disbursement_id: meta.disbursementId,
    created_at: meta.createdAt ?? null,
    created_by_user_id: meta.createdByUserId ?? null,
    created_by_label: meta.createdByLabel ?? null,
    invites_sent_at: meta.invitesSentAt ?? null,
    invites_sent_by: meta.invitesSentBy ?? null,
    invites_sent_by_label: meta.invitesSentByLabel ?? null,
    hotlink_at: meta.hotlinkAt ?? null,
    hotlink_by: meta.hotlinkBy ?? null,
    hotlink_by_label: meta.hotlinkByLabel ?? null,
    payments_started_at: meta.paymentsStartedAt ?? null,
    payments_started_by: meta.paymentsStartedBy ?? null,
    payments_started_by_label: meta.paymentsStartedByLabel ?? null,
  };
}

export async function fetchDisbursementMeta(
  disbursementId: string
): Promise<DisbursementMeta | null> {
  const { data, error } = await getSupabase()
    .from("sdp_disbursement_meta")
    .select("*")
    .eq("disbursement_id", disbursementId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowToMeta(data as MetaRow);
}

export async function fetchAllDisbursementMeta(): Promise<Record<string, DisbursementMeta>> {
  const { data, error } = await getSupabase().from("sdp_disbursement_meta").select("*");
  if (error) throw new Error(error.message);
  const out: Record<string, DisbursementMeta> = {};
  for (const row of data ?? []) {
    const meta = rowToMeta(row as MetaRow);
    out[meta.disbursementId] = meta;
  }
  return out;
}

/** Upsert full meta row (merge-friendly via read-modify-write in caller). */
export async function upsertDisbursementMeta(meta: DisbursementMeta): Promise<void> {
  const row = metaToRow(meta);
  const { error } = await getSupabase()
    .from("sdp_disbursement_meta")
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "disbursement_id" });
  if (error) throw new Error(error.message);
}
