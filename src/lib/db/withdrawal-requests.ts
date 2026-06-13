import { getSupabase } from "@/lib/supabase/server";

export type WithdrawalStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

export type WithdrawalRequest = {
  id: string;
  org_id: string;
  amount_usd: string;
  source_stellar_address: string;
  bank_account_holder: string;
  bank_country: string;
  bank_account_number: string;
  bank_routing_code: string | null;
  bank_currency: string | null;
  status: WithdrawalStatus;
  provider_withdrawal_id: string | null;
  provider_event_at: string | null;
  external_ref: string;
  estimated_arrival: string | null;
  fiat_sent_at: string | null;
  fiat_sent_by: string | null;
  merchant_confirmed_at: string | null;
  release_tx_hash: string | null;
  release_destination_address: string | null;
  created_at: string;
  updated_at: string;
};

export async function createWithdrawalRequest(params: {
  id: string;
  orgId: string;
  amountUsd: string;
  sourceStellarAddress: string;
  bankAccountHolder: string;
  bankCountry: string;
  bankAccountNumber: string;
  bankRoutingCode?: string;
  bankCurrency?: string;
  providerWithdrawalId: string;
  estimatedArrival?: string;
}): Promise<WithdrawalRequest> {
  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from("withdrawal_requests")
    .insert({
      id: params.id,
      org_id: params.orgId,
      amount_usd: params.amountUsd,
      source_stellar_address: params.sourceStellarAddress,
      bank_account_holder: params.bankAccountHolder,
      bank_country: params.bankCountry,
      bank_account_number: params.bankAccountNumber,
      bank_routing_code: params.bankRoutingCode ?? null,
      bank_currency: params.bankCurrency ?? null,
      status: "pending",
      provider_withdrawal_id: params.providerWithdrawalId,
      external_ref: params.id,
      estimated_arrival: params.estimatedArrival ?? null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as WithdrawalRequest;
}

export async function listWithdrawalRequestsForOrg(
  orgId: string,
  limit = 20,
): Promise<WithdrawalRequest[]> {
  const { data, error } = await getSupabase()
    .from("withdrawal_requests")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[withdrawal-requests] list error:", error.message);
    return [];
  }
  return (data as WithdrawalRequest[]) ?? [];
}

export async function getWithdrawalForOrg(
  id: string,
  orgId: string,
): Promise<WithdrawalRequest | null> {
  const { data, error } = await getSupabase()
    .from("withdrawal_requests")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    console.error("[withdrawal-requests] get error:", error.message);
    return null;
  }
  return (data as WithdrawalRequest) ?? null;
}

export async function getActivePendingWithdrawalForOrg(
  orgId: string,
): Promise<WithdrawalRequest | null> {
  const { data, error } = await getSupabase()
    .from("withdrawal_requests")
    .select("*")
    .eq("org_id", orgId)
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[withdrawal-requests] active pending error:", error.message);
    return null;
  }
  return (data as WithdrawalRequest) ?? null;
}

export async function cancelWithdrawalRequest(
  id: string,
  orgId: string,
): Promise<WithdrawalRequest | null> {
  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from("withdrawal_requests")
    .update({ status: "cancelled", updated_at: now })
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (error) {
    console.error("[withdrawal-requests] cancel error:", error.message);
    return null;
  }
  return (data as WithdrawalRequest) ?? null;
}

export async function markWithdrawalReleased(params: {
  id: string;
  orgId: string;
  releaseTxHash: string;
  releaseDestinationAddress: string;
}): Promise<WithdrawalRequest | null> {
  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from("withdrawal_requests")
    .update({
      status: "completed",
      updated_at: now,
      merchant_confirmed_at: now,
      provider_event_at: now,
      release_tx_hash: params.releaseTxHash,
      release_destination_address: params.releaseDestinationAddress,
    })
    .eq("id", params.id)
    .eq("org_id", params.orgId)
    .eq("status", "processing")
    .select()
    .maybeSingle();

  if (error) {
    console.error("[withdrawal-requests] release error:", error.message);
    return null;
  }
  return (data as WithdrawalRequest) ?? null;
}

export async function listPendingWithdrawalsForAdmin(
  limit = 100,
): Promise<WithdrawalRequest[]> {
  const { data, error } = await getSupabase()
    .from("withdrawal_requests")
    .select("*")
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[withdrawal-requests] admin list error:", error.message);
    return [];
  }
  return (data as WithdrawalRequest[]) ?? [];
}

export async function markWithdrawalCompleted(id: string): Promise<WithdrawalRequest | null> {
  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from("withdrawal_requests")
    .update({
      status: "completed",
      updated_at: now,
      provider_event_at: now,
    })
    .eq("id", id)
    .in("status", ["pending", "processing"])
    .select()
    .maybeSingle();

  if (error) {
    console.error("[withdrawal-requests] complete error:", error.message);
    return null;
  }
  return (data as WithdrawalRequest) ?? null;
}

export async function countPendingWithdrawalsForAdmin(): Promise<number> {
  const { count, error } = await getSupabase()
    .from("withdrawal_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  if (error) {
    console.error("[withdrawal-requests] count error:", error.message);
    return 0;
  }
  return count ?? 0;
}
