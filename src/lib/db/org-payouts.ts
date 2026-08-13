import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import type { PayoutRecord } from "@/lib/payouts";

type OrgPayoutRow = {
  id: string;
  org_id: string | null;
  user_id: string;
  amount: string;
  type: "to_bank" | "to_stellar";
  bank_account_id: string | null;
  stellar_address: string | null;
  recipient_label: string | null;
  stellar_tx_hash: string | null;
  status: "pending" | "completed" | "failed";
  created_at: string;
};

function rowToRecord(row: OrgPayoutRow): PayoutRecord {
  return {
    id: row.id,
    userId: row.user_id,
    orgId: row.org_id,
    amount: row.amount,
    type: row.type,
    bankAccountId: row.bank_account_id ?? undefined,
    stellarAddress: row.stellar_address ?? undefined,
    recipientLabel: row.recipient_label ?? undefined,
    stellarTxHash: row.stellar_tx_hash ?? undefined,
    status: row.status,
    createdAt: row.created_at,
  };
}

function persistDisabled(): boolean {
  return !isSupabaseConfigured();
}

export async function insertOrgPayout(record: PayoutRecord): Promise<void> {
  if (persistDisabled()) return;
  const { error } = await getSupabase().from("org_payouts").insert({
    id: record.id,
    org_id: record.orgId ?? null,
    user_id: record.userId,
    amount: record.amount,
    type: record.type,
    bank_account_id: record.bankAccountId ?? null,
    stellar_address: record.stellarAddress ?? null,
    recipient_label: record.recipientLabel ?? null,
    stellar_tx_hash: record.stellarTxHash ?? null,
    status: record.status,
    created_at: record.createdAt,
    updated_at: record.createdAt,
  });
  if (error) {
    console.error("[org_payouts] insert:", error.message);
  }
}

export async function updateOrgPayout(
  id: string,
  patch: { status?: PayoutRecord["status"]; stellarTxHash?: string }
): Promise<void> {
  if (persistDisabled()) return;
  const payload: Record<string, string> = { updated_at: new Date().toISOString() };
  if (patch.status) payload.status = patch.status;
  if (patch.stellarTxHash) payload.stellar_tx_hash = patch.stellarTxHash;
  const { error } = await getSupabase().from("org_payouts").update(payload).eq("id", id);
  if (error) {
    console.error("[org_payouts] update:", error.message);
  }
}

export async function selectOrgPayoutById(id: string, userId: string): Promise<PayoutRecord | null> {
  if (persistDisabled()) return null;
  const { data, error } = await getSupabase()
    .from("org_payouts")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[org_payouts] select by id:", error.message);
    return null;
  }
  return data ? rowToRecord(data as OrgPayoutRow) : null;
}

export async function selectOrgPayoutsForUser(userId: string, limit: number): Promise<PayoutRecord[] | null> {
  if (persistDisabled()) return null;
  const { data, error } = await getSupabase()
    .from("org_payouts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[org_payouts] list user:", error.message);
    return null;
  }
  return (data as OrgPayoutRow[] | null)?.map(rowToRecord) ?? [];
}

export async function selectCompletedStellarPayoutsForOrg(
  orgId: string,
  limit: number
): Promise<PayoutRecord[]> {
  if (persistDisabled()) return [];
  const { data, error } = await getSupabase()
    .from("org_payouts")
    .select("*")
    .eq("org_id", orgId)
    .eq("type", "to_stellar")
    .eq("status", "completed")
    .not("stellar_tx_hash", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[org_payouts] list org stellar:", error.message);
    return [];
  }
  return (data as OrgPayoutRow[] | null)?.map(rowToRecord) ?? [];
}
