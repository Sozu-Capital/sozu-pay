import { isCheckoutExpired } from "@/lib/checkout/expiration";
import { reusableChargeSources } from "@/lib/dashboard/payment-link";
import { getSupabase } from "@/lib/supabase/server";

export type CheckoutSessionStatus = "pending" | "completed" | "failed" | "expired";

export type CheckoutSession = {
  id: string;
  org_id: string;
  amount_usd: string;
  amount_clp: string | null;
  pricing_currency: string | null;
  fx_rate_clp_per_usdc: number | null;
  fx_source: string | null;
  idempotency_key: string | null;
  reference: string | null;
  status: CheckoutSessionStatus;
  destination_stellar_address: string;
  provider_session_id: string | null;
  provider_url: string | null;
  provider_event_at: string | null;
  payment_method: string | null;
  allow_debit: boolean;
  allow_credit: boolean;
  allow_bank_transfer: boolean;
  stellar_tx_hash: string | null;
  completed_payment_method: string | null;
  deleted_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function createCheckoutSession(params: {
  id: string;
  orgId: string;
  amountUsd: string;
  amountClp?: string;
  pricingCurrency?: string;
  fxRateClpPerUsdc?: number;
  fxSource?: string;
  idempotencyKey?: string;
  reference?: string;
  destinationStellarAddress: string;
  providerSessionId: string;
  providerUrl: string;
  providerExpiresAt?: string;
  expiresAt?: string;
  paymentMethod?: string;
  allowDebit?: boolean;
  allowCredit?: boolean;
  allowBankTransfer?: boolean;
}): Promise<CheckoutSession> {
  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from("checkout_sessions")
    .insert({
      id: params.id,
      org_id: params.orgId,
      amount_usd: params.amountUsd,
      amount_clp: params.amountClp ?? null,
      pricing_currency: params.pricingCurrency ?? null,
      fx_rate_clp_per_usdc: params.fxRateClpPerUsdc ?? null,
      fx_source: params.fxSource ?? null,
      idempotency_key: params.idempotencyKey ?? null,
      reference: params.reference ?? null,
      status: "pending",
      destination_stellar_address: params.destinationStellarAddress,
      provider_session_id: params.providerSessionId,
      provider_url: params.providerUrl,
      payment_method: params.paymentMethod ?? null,
      allow_debit: params.allowDebit ?? true,
      allow_credit: params.allowCredit ?? true,
      allow_bank_transfer: params.allowBankTransfer ?? true,
      expires_at: params.expiresAt ?? null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as CheckoutSession;
}

export async function markCheckoutSessionExpired(id: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await getSupabase()
    .from("checkout_sessions")
    .update({ status: "expired", updated_at: now })
    .eq("id", id)
    .eq("status", "pending")
    .is("deleted_at", null);

  if (error) {
    console.error("[checkout-sessions] markExpired error:", error.message);
  }
}

export async function getCheckoutSessionByIdempotencyKey(
  orgId: string,
  idempotencyKey: string,
): Promise<CheckoutSession | null> {
  const { data, error } = await getSupabase()
    .from("checkout_sessions")
    .select("*")
    .eq("org_id", orgId)
    .eq("idempotency_key", idempotencyKey)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[checkout-sessions] getByIdempotencyKey error:", error.message);
    return null;
  }
  return (data as CheckoutSession) ?? null;
}

/** Latest non-deleted pending checkout for an org (live payment link). */
export async function getLatestPendingCheckoutForOrg(
  orgId: string,
): Promise<CheckoutSession | null> {
  const { data, error } = await getSupabase()
    .from("checkout_sessions")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "pending")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[checkout-sessions] getLatestPendingCheckoutForOrg error:", error.message);
    return null;
  }
  return (data as CheckoutSession) ?? null;
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

export async function getCheckoutSessionByTxHash(
  stellarTxHash: string,
): Promise<CheckoutSession | null> {
  const { data, error } = await getSupabase()
    .from("checkout_sessions")
    .select("*")
    .eq("stellar_tx_hash", stellarTxHash)
    .maybeSingle();

  if (error) {
    console.error("[checkout-sessions] getCheckoutSessionByTxHash error:", error.message);
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
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[checkout-sessions] list error:", error.message);
    return [];
  }
  return (data as CheckoutSession[]) ?? [];
}

export async function updateCheckoutSession(
  id: string,
  orgId: string,
  updates: {
    amountUsd?: string;
    reference?: string;
    paymentMethod?: string;
    allowDebit?: boolean;
    allowCredit?: boolean;
    allowBankTransfer?: boolean;
  }
): Promise<CheckoutSession | null> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  
  if (updates.amountUsd !== undefined) payload.amount_usd = updates.amountUsd;
  if (updates.reference !== undefined) payload.reference = updates.reference || null;
  if (updates.paymentMethod !== undefined) payload.payment_method = updates.paymentMethod;
  if (updates.allowDebit !== undefined) payload.allow_debit = updates.allowDebit;
  if (updates.allowCredit !== undefined) payload.allow_credit = updates.allowCredit;
  if (updates.allowBankTransfer !== undefined) payload.allow_bank_transfer = updates.allowBankTransfer;

  const { data, error } = await getSupabase()
    .from("checkout_sessions")
    .update(payload)
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("status", "pending")
    .is("deleted_at", null)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[checkout-sessions] update error:", error.message);
    return null;
  }
  return (data as CheckoutSession) ?? null;
}

export async function softDeleteCheckoutSession(
  id: string,
  orgId: string
): Promise<boolean> {
  const { error } = await getSupabase()
    .from("checkout_sessions")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("status", "pending")
    .is("deleted_at", null);

  if (error) {
    console.error("[checkout-sessions] soft delete error:", error.message);
    return false;
  }
  return true;
}

/**
 * One live one-shot sale per org. Standing payment links and open-amount
 * sends stay pending — a new sale must not kill them.
 */
export async function expirePendingCheckoutSessionsForOrg(
  orgId: string,
  exceptId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await getSupabase()
    .from("checkout_sessions")
    .update({ status: "expired", updated_at: now })
    .eq("org_id", orgId)
    .eq("status", "pending")
    .is("deleted_at", null)
    .neq("id", exceptId)
    .or(
      `fx_source.is.null,fx_source.not.in.(${reusableChargeSources().join(",")})`,
    );

  if (error) {
    console.error("[checkout-sessions] expire pending error:", error.message);
  }
}

/** Completed POS/checkout charges for store reconciliation (newest first). */
export async function listCompletedCheckoutSessionsForOrg(
  orgId: string,
  limit = 200,
): Promise<CheckoutSession[]> {
  const { data, error } = await getSupabase()
    .from("checkout_sessions")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "completed")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 500));

  if (error) {
    console.error("[checkout-sessions] listCompleted error:", error.message);
    return [];
  }
  return (data ?? []) as CheckoutSession[];
}

export function mapCheckoutSessionForApi(session: CheckoutSession) {
  return {
    id: session.id,
    status: session.status,
    amountUsd: session.amount_usd,
    amountClp: session.amount_clp,
    pricingCurrency: session.pricing_currency,
    fxRateClpPerUsdc: session.fx_rate_clp_per_usdc,
    fxSource: session.fx_source,
    reference: session.reference,
    createdAt: session.created_at,
    paymentMethod: session.payment_method,
    allowDebit: session.allow_debit,
    allowCredit: session.allow_credit,
    allowBankTransfer: session.allow_bank_transfer,
    organizationId: session.org_id,
    stellarTxHash: session.stellar_tx_hash,
    completedPaymentMethod: session.completed_payment_method,
    expiresAt: session.expires_at,
  };
}

export async function completeCheckoutSession(
  id: string,
  stellarTxHash: string,
  paymentMethod: "sozu" | "card" | "bank_transfer"
): Promise<CheckoutSession | null> {
  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from("checkout_sessions")
    .update({
      status: "completed",
      stellar_tx_hash: stellarTxHash,
      completed_payment_method: paymentMethod,
      updated_at: now,
    })
    .eq("id", id)
    .eq("status", "pending")
    .is("deleted_at", null)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[checkout-sessions] complete error:", error.message);
    return null;
  }
  return (data as CheckoutSession) ?? null;
}

/** Open and finished checkouts that claimed a number on this payment link. */
export async function listCollectibleEditionSessions(
  orgId: string,
  slug: string,
): Promise<CheckoutSession[]> {
  const { data, error } = await getSupabase()
    .from("checkout_sessions")
    .select("*")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .like("idempotency_key", "edition:%");

  if (error) throw new Error(error.message);
  const prefix = `edition:${slug}:`;
  return ((data ?? []) as CheckoutSession[]).filter((row) =>
    row.idempotency_key?.startsWith(prefix),
  );
}

/** Gives a shirt number back when the checkout failed or expired before payment. */
export async function releaseStaleCollectibleEdition(
  session: CheckoutSession,
  now = new Date(),
): Promise<void> {
  const key = session.idempotency_key;
  if (!key) return;
  const nowIso = now.toISOString();

  if (session.status === "failed") {
    const { error } = await getSupabase()
      .from("checkout_sessions")
      .update({ idempotency_key: null, updated_at: nowIso })
      .eq("id", session.id)
      .eq("status", "failed")
      .eq("idempotency_key", key);
    if (error) console.error("[edition] release failed hold:", error.message);
    return;
  }

  if (session.status === "pending" && isCheckoutExpired(session.expires_at, now)) {
    const { error } = await getSupabase()
      .from("checkout_sessions")
      .update({ idempotency_key: null, status: "expired", updated_at: nowIso })
      .eq("id", session.id)
      .eq("status", "pending")
      .eq("idempotency_key", key)
      .lte("expires_at", nowIso);
    if (error) console.error("[edition] release expired hold:", error.message);
  }
}
