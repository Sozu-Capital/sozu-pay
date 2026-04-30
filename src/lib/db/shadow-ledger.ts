import { getSupabase } from "@/lib/supabase/server";
import { quoteClpToUsdcMinor, readShadowFxConfig, usdcMinorToDisplayString } from "@/lib/shadow-ledger-quote";

export type PaymentOrderStatus =
  | "pending_payment"
  | "awaiting_confirmation"
  | "confirmed"
  | "expired"
  | "cancelled"
  | "failed";

export type LedgerWalletRow = {
  id: string;
  org_id: string;
  stellar_address: string | null;
  created_at: string;
  updated_at: string;
};

export type LedgerBalanceRow = {
  id: string;
  wallet_id: string;
  asset_code: string;
  available_minor: number;
  pending_withdrawal_minor: number;
  updated_at: string;
};

export type PaymentOrderRow = {
  id: string;
  public_ref: string;
  org_id: string;
  wallet_id: string;
  amount_clp: number;
  quoted_usdc_minor: number;
  fx_clp_per_usdc: string;
  spread_bps: number;
  status: PaymentOrderStatus;
  payer_reference: string | null;
  expires_at: string | null;
  confirmed_at: string | null;
  confirmed_by_user_id: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type LedgerTransactionRow = {
  id: string;
  wallet_id: string;
  order_id: string | null;
  type: string;
  amount_minor: number;
  balance_after_minor: number | null;
  idempotency_key: string | null;
  memo: string | null;
  created_at: string;
};

export type WithdrawalRequestRow = {
  id: string;
  org_id: string;
  wallet_id: string;
  amount_usdc_minor: number;
  note: string | null;
  status: "pending_ops" | "fulfilled" | "cancelled";
  requested_by_user_id: number | null;
  fulfilled_at: string | null;
  fulfilled_by_user_id: number | null;
  created_at: string;
};

const PUBLIC_REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomPublicRef(length = 12): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < length; i++) {
    s += PUBLIC_REF_ALPHABET[bytes[i]! % PUBLIC_REF_ALPHABET.length];
  }
  return s;
}

export async function getLedgerWalletByOrgId(
  orgId: string
): Promise<LedgerWalletRow | null> {
  const { data, error } = await getSupabase()
    .from("ledger_wallets")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    console.error("[shadow-ledger] getLedgerWalletByOrgId:", error.message);
    return null;
  }
  return data as LedgerWalletRow | null;
}

export async function getOrCreateLedgerWallet(
  orgId: string,
  stellarAddress: string | null
): Promise<LedgerWalletRow> {
  const existing = await getLedgerWalletByOrgId(orgId);
  if (existing) {
    if (stellarAddress && stellarAddress !== existing.stellar_address) {
      const { data, error } = await getSupabase()
        .from("ledger_wallets")
        .update({
          stellar_address: stellarAddress,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (!error && data) return data as LedgerWalletRow;
    }
    return existing;
  }

  const { data: wallet, error: wErr } = await getSupabase()
    .from("ledger_wallets")
    .insert({
      org_id: orgId,
      stellar_address: stellarAddress,
    })
    .select()
    .single();

  if (wErr) throw new Error(`ledger_wallets insert: ${wErr.message}`);

  const w = wallet as LedgerWalletRow;
  const { error: bErr } = await getSupabase().from("ledger_balances").insert({
    wallet_id: w.id,
    asset_code: "USDC",
    available_minor: 0,
    pending_withdrawal_minor: 0,
  });

  if (bErr) throw new Error(`ledger_balances insert: ${bErr.message}`);
  return w;
}

export async function getLedgerBalanceForWallet(
  walletId: string
): Promise<LedgerBalanceRow | null> {
  const { data, error } = await getSupabase()
    .from("ledger_balances")
    .select("*")
    .eq("wallet_id", walletId)
    .eq("asset_code", "USDC")
    .maybeSingle();

  if (error) {
    console.error("[shadow-ledger] getLedgerBalanceForWallet:", error.message);
    return null;
  }
  return data as LedgerBalanceRow | null;
}

export async function createPaymentOrder(params: {
  orgId: string;
  walletId: string;
  amountClp: number;
  payerReference?: string | null;
  expiresAt?: Date | null;
}): Promise<PaymentOrderRow> {
  const { marketClpPerUsdc, spreadBps } = readShadowFxConfig();
  const { quotedUsdcMinor, effectiveClpPerUsdc } = quoteClpToUsdcMinor(
    params.amountClp,
    marketClpPerUsdc,
    spreadBps
  );

  let publicRef = randomPublicRef();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await getSupabase()
      .from("payment_orders")
      .insert({
        public_ref: publicRef,
        org_id: params.orgId,
        wallet_id: params.walletId,
        amount_clp: Math.floor(params.amountClp),
        quoted_usdc_minor: Number(quotedUsdcMinor),
        fx_clp_per_usdc: effectiveClpPerUsdc.toFixed(8),
        spread_bps: spreadBps,
        status: "pending_payment",
        payer_reference: params.payerReference ?? null,
        expires_at: params.expiresAt?.toISOString() ?? null,
      })
      .select()
      .single();

    if (!error && data) return data as PaymentOrderRow;
    if (error?.code === "23505") {
      publicRef = randomPublicRef();
      continue;
    }
    throw new Error(`payment_orders insert: ${error?.message ?? "unknown"}`);
  }
  throw new Error("Could not allocate unique public_ref");
}

export async function getPaymentOrderByPublicRef(
  publicRef: string
): Promise<PaymentOrderRow | null> {
  const { data, error } = await getSupabase()
    .from("payment_orders")
    .select("*")
    .eq("public_ref", publicRef.trim())
    .maybeSingle();

  if (error) {
    console.error("[shadow-ledger] getPaymentOrderByPublicRef:", error.message);
    return null;
  }
  return data as PaymentOrderRow | null;
}

export async function getPaymentOrderByIdForOrg(
  orderId: string,
  orgId: string
): Promise<PaymentOrderRow | null> {
  const { data, error } = await getSupabase()
    .from("payment_orders")
    .select("*")
    .eq("id", orderId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) return null;
  return data as PaymentOrderRow | null;
}

export async function listPaymentOrdersByOrg(
  orgId: string,
  limit = 50
): Promise<PaymentOrderRow[]> {
  const { data, error } = await getSupabase()
    .from("payment_orders")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[shadow-ledger] listPaymentOrdersByOrg:", error.message);
    return [];
  }
  return (data as PaymentOrderRow[]) ?? [];
}

export async function listPendingPaymentOrdersForAdmin(
  limit = 100
): Promise<PaymentOrderRow[]> {
  const { data, error } = await getSupabase()
    .from("payment_orders")
    .select("*")
    .in("status", ["pending_payment", "awaiting_confirmation"])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[shadow-ledger] listPendingPaymentOrdersForAdmin:", error.message);
    return [];
  }
  return (data as PaymentOrderRow[]) ?? [];
}

function parseRpcJsonResult(data: unknown): Record<string, unknown> | null {
  if (data == null) return null;
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return null;
}

export type ConfirmOrderRpcResult = {
  ok: boolean;
  error?: string;
  status?: string;
  already_confirmed?: boolean;
  order_id?: string;
  credited_usdc_minor?: number;
  balance_after_minor?: number;
};

export async function rpcConfirmPaymentOrder(
  orderId: string,
  confirmedByUserId: number
): Promise<ConfirmOrderRpcResult> {
  const { data, error } = await getSupabase().rpc("confirm_shadow_payment_order", {
    p_order_id: orderId,
    p_confirmed_by: confirmedByUserId,
  });

  if (error) {
    console.error("[shadow-ledger] rpcConfirmPaymentOrder:", error.message);
    return { ok: false, error: error.message };
  }
  const row = parseRpcJsonResult(data);
  if (!row) {
    return { ok: false, error: "empty_rpc_result" };
  }
  return {
    ok: row.ok === true,
    error: typeof row.error === "string" ? row.error : undefined,
    status: typeof row.status === "string" ? row.status : undefined,
    already_confirmed: row.already_confirmed === true,
    order_id: typeof row.order_id === "string" ? row.order_id : undefined,
    credited_usdc_minor:
      typeof row.credited_usdc_minor === "number" ? row.credited_usdc_minor : undefined,
    balance_after_minor:
      typeof row.balance_after_minor === "number" ? row.balance_after_minor : undefined,
  };
}

export async function listLedgerTransactionsForWallet(
  walletId: string,
  limit = 50
): Promise<LedgerTransactionRow[]> {
  const { data, error } = await getSupabase()
    .from("ledger_transactions")
    .select("*")
    .eq("wallet_id", walletId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[shadow-ledger] listLedgerTransactionsForWallet:", error.message);
    return [];
  }
  return (data as LedgerTransactionRow[]) ?? [];
}

export async function createWithdrawalRequest(params: {
  orgId: string;
  walletId: string;
  amountUsdcMinor: bigint;
  note?: string | null;
  requestedByUserId: number | null;
}): Promise<WithdrawalRequestRow> {
  const { data, error } = await getSupabase()
    .from("withdrawal_requests")
    .insert({
      org_id: params.orgId,
      wallet_id: params.walletId,
      amount_usdc_minor: Number(params.amountUsdcMinor),
      note: params.note ?? null,
      status: "pending_ops",
      requested_by_user_id: params.requestedByUserId,
    })
    .select()
    .single();

  if (error) throw new Error(`withdrawal_requests insert: ${error.message}`);
  return data as WithdrawalRequestRow;
}

export async function listWithdrawalRequestsForOrg(
  orgId: string,
  limit = 30
): Promise<WithdrawalRequestRow[]> {
  const { data, error } = await getSupabase()
    .from("withdrawal_requests")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data as WithdrawalRequestRow[]) ?? [];
}

export async function listPendingWithdrawalsForAdmin(
  limit = 100
): Promise<WithdrawalRequestRow[]> {
  const { data, error } = await getSupabase()
    .from("withdrawal_requests")
    .select("*")
    .eq("status", "pending_ops")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) return [];
  return (data as WithdrawalRequestRow[]) ?? [];
}

export type FulfillWithdrawalRpcResult = {
  ok: boolean;
  error?: string;
  status?: string;
  debited_usdc_minor?: number;
  balance_after_minor?: number;
};

export async function rpcFulfillWithdrawalRequest(
  requestId: string,
  fulfilledByUserId: number
): Promise<FulfillWithdrawalRpcResult> {
  const { data, error } = await getSupabase().rpc("fulfill_shadow_withdrawal_request", {
    p_request_id: requestId,
    p_fulfilled_by: fulfilledByUserId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  const row = parseRpcJsonResult(data);
  if (!row) {
    return { ok: false, error: "empty_rpc_result" };
  }
  return {
    ok: row.ok === true,
    error: typeof row.error === "string" ? row.error : undefined,
    status: typeof row.status === "string" ? row.status : undefined,
    debited_usdc_minor:
      typeof row.debited_usdc_minor === "number" ? row.debited_usdc_minor : undefined,
    balance_after_minor:
      typeof row.balance_after_minor === "number" ? row.balance_after_minor : undefined,
  };
}

export function formatOrderForApi(row: PaymentOrderRow) {
  return {
    id: row.id,
    publicRef: row.public_ref,
    orgId: row.org_id,
    amountClp: row.amount_clp,
    quotedUsdc: usdcMinorToDisplayString(BigInt(row.quoted_usdc_minor)),
    quotedUsdcMinor: String(row.quoted_usdc_minor),
    fxClpPerUsdc: row.fx_clp_per_usdc,
    spreadBps: row.spread_bps,
    status: row.status,
    payerReference: row.payer_reference,
    expiresAt: row.expires_at,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
  };
}
