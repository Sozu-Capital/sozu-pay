import { getSupabase } from "@/lib/supabase/server";

export type PizzaRedeemStatus = "pending" | "signed" | "submitted" | "failed";

export type PizzaRedeem = {
  id: string;
  qrPointId: string;
  orgId: string;
  guestAddress: string;
  storeAddress: string;
  tokenId: string;
  amount: number;
  status: PizzaRedeemStatus;
  txHash: string | null;
  createdAt: string;
  updatedAt: string;
};

function fromDb(row: Record<string, unknown>): PizzaRedeem {
  return {
    id: row.id as string,
    qrPointId: row.qr_point_id as string,
    orgId: row.org_id as string,
    guestAddress: row.guest_address as string,
    storeAddress: row.store_address as string,
    tokenId: row.token_id as string,
    amount: row.amount as number,
    status: row.status as PizzaRedeemStatus,
    txHash: (row.tx_hash as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function createPizzaRedeem(params: {
  qrPointId: string;
  orgId: string;
  guestAddress: string;
  storeAddress: string;
  tokenId: string;
}): Promise<PizzaRedeem> {
  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from("pizza_redeems")
    .insert({
      qr_point_id: params.qrPointId,
      org_id: params.orgId,
      guest_address: params.guestAddress,
      store_address: params.storeAddress,
      token_id: params.tokenId,
      amount: 1,
      status: "pending",
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return fromDb(data);
}

export async function getPizzaRedeem(id: string): Promise<PizzaRedeem | null> {
  const { data, error } = await getSupabase()
    .from("pizza_redeems")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[pizza-redeems] get error:", error.message);
    return null;
  }
  return data ? fromDb(data) : null;
}

export async function listSubmittedPizzaRedeemsForOrg(
  orgId: string
): Promise<Array<{ qrPointId: string; amount: number }>> {
  const { data, error } = await getSupabase()
    .from("pizza_redeems")
    .select("qr_point_id, amount")
    .eq("org_id", orgId)
    .eq("status", "submitted");

  if (error) {
    console.error("[pizza-redeems] list submitted error:", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    qrPointId: row.qr_point_id as string,
    amount: Number(row.amount) || 0,
  }));
}

/** Redeems for store recon windows (confirmed = submitted). Newest first. */
export async function listPizzaRedeemsForOrgReconciliation(
  orgId: string,
): Promise<PizzaRedeem[]> {
  const { data, error } = await getSupabase()
    .from("pizza_redeems")
    .select("*")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[pizza-redeems] list for recon error:", error.message);
    return [];
  }
  return (data ?? []).map((row) => fromDb(row as Record<string, unknown>));
}

export async function markPizzaRedeemSubmitted(
  id: string,
  txHash: string,
): Promise<PizzaRedeem | null> {
  const { data, error } = await getSupabase()
    .from("pizza_redeems")
    .update({
      status: "submitted",
      tx_hash: txHash,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[pizza-redeems] submit error:", error.message);
    return null;
  }
  return data ? fromDb(data) : null;
}

export async function markPizzaRedeemFailed(id: string): Promise<PizzaRedeem | null> {
  const { data, error } = await getSupabase()
    .from("pizza_redeems")
    .update({
      status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[pizza-redeems] fail error:", error.message);
    return null;
  }
  return data ? fromDb(data) : null;
}
