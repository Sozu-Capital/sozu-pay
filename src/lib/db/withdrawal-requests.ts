import { getSupabase } from "@/lib/supabase/server";

export type WithdrawalStatus = "pending" | "processing" | "completed" | "failed";

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
