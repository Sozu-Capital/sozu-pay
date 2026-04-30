import { getSupabase } from "@/lib/supabase/server";

export type CheckoutSessionStatus = "pending" | "completed" | "failed" | "expired";

export type CheckoutSession = {
  id: string;
  org_id: string;
  amount_usd: string;
  reference: string | null;
  status: CheckoutSessionStatus;
  destination_stellar_address: string;
  provider_session_id: string | null;
  provider_url: string | null;
  provider_event_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function createCheckoutSession(params: {
  id: string;
  orgId: string;
  amountUsd: string;
  reference?: string;
  destinationStellarAddress: string;
  providerSessionId: string;
  providerUrl: string;
  providerExpiresAt?: string;
}): Promise<CheckoutSession> {
  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from("checkout_sessions")
    .insert({
      id: params.id,
      org_id: params.orgId,
      amount_usd: params.amountUsd,
      reference: params.reference ?? null,
      status: "pending",
      destination_stellar_address: params.destinationStellarAddress,
      provider_session_id: params.providerSessionId,
      provider_url: params.providerUrl,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as CheckoutSession;
}

export async function getCheckoutSession(id: string): Promise<CheckoutSession | null> {
  const { data, error } = await getSupabase()
    .from("checkout_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[checkout-sessions] getCheckoutSession error:", error.message);
    return null;
  }
  return (data as CheckoutSession) ?? null;
}

export async function listCheckoutSessionsForOrg(
  orgId: string,
  limit = 20,
): Promise<CheckoutSession[]> {
  const { data, error } = await getSupabase()
    .from("checkout_sessions")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[checkout-sessions] list error:", error.message);
    return [];
  }
  return (data as CheckoutSession[]) ?? [];
}
