/**
 * Merchant POS payment-request create (extends checkout sessions).
 *
 * Idempotency:
 * - Client may send `Idempotency-Key` (header) or `idempotencyKey` (body).
 * - First successful create for (orgId, key) wins and is returned on retries.
 * - A retry with the same key but a different amountClp/amountUsd returns 409.
 * - Missing key → new charge every time (legacy funding-link / checkout page behavior).
 */

import {
  parseWholeClpAmount,
  type ClpPricingQuote,
} from "@/lib/pos/clp-pricing";

export type PaymentRequestAmountInput =
  | { kind: "clp"; amountClp: string }
  | { kind: "usd"; amountUsd: string };

export type ParsedPaymentRequestBody = {
  amount: PaymentRequestAmountInput;
  reference?: string;
  paymentMethod?: "card" | "bank_transfer";
  allowDebit: boolean;
  allowCredit: boolean;
  allowBankTransfer: boolean;
  idempotencyKey?: string;
};

export type PaymentRequestValidationError = {
  status: 400;
  error: string;
  code: "INVALID_AMOUNT" | "INVALID_BODY";
};

export function parsePaymentRequestBody(
  body: unknown,
  idempotencyKeyFromHeader?: string | null,
): ParsedPaymentRequestBody | PaymentRequestValidationError {
  if (body == null || typeof body !== "object") {
    return { status: 400, error: "Invalid JSON body", code: "INVALID_BODY" };
  }
  const b = body as Record<string, unknown>;
  const amountClp = typeof b.amountClp === "string" ? b.amountClp.trim() : "";
  const amountUsd = typeof b.amountUsd === "string" ? b.amountUsd.trim() : "";
  const reference = typeof b.reference === "string" ? b.reference.trim() : undefined;
  const paymentMethod =
    b.paymentMethod === "card" || b.paymentMethod === "bank_transfer"
      ? b.paymentMethod
      : undefined;
  const allowDebit = typeof b.allowDebit === "boolean" ? b.allowDebit : true;
  const allowCredit = typeof b.allowCredit === "boolean" ? b.allowCredit : true;
  const allowBankTransfer =
    typeof b.allowBankTransfer === "boolean" ? b.allowBankTransfer : true;

  const headerKey =
    typeof idempotencyKeyFromHeader === "string" ? idempotencyKeyFromHeader.trim() : "";
  const bodyKey = typeof b.idempotencyKey === "string" ? b.idempotencyKey.trim() : "";
  const idempotencyKey = headerKey || bodyKey || undefined;

  if (amountClp) {
    if (parseWholeClpAmount(amountClp) == null) {
      return {
        status: 400,
        error: "amountClp must be a positive whole-peso amount",
        code: "INVALID_AMOUNT",
      };
    }
    return {
      amount: { kind: "clp", amountClp },
      reference: reference || undefined,
      paymentMethod,
      allowDebit,
      allowCredit,
      allowBankTransfer,
      idempotencyKey,
    };
  }

  if (!amountUsd || isNaN(parseFloat(amountUsd)) || parseFloat(amountUsd) <= 0) {
    return {
      status: 400,
      error: "amountClp or amountUsd must be a positive number",
      code: "INVALID_AMOUNT",
    };
  }

  return {
    amount: { kind: "usd", amountUsd },
    reference: reference || undefined,
    paymentMethod,
    allowDebit,
    allowCredit,
    allowBankTransfer,
    idempotencyKey,
  };
}

export type IdempotentReplayDecision =
  | { action: "create" }
  | { action: "replay" }
  | { action: "conflict"; error: string; code: "IDEMPOTENCY_CONFLICT" };

/**
 * Decide whether an existing pending session for this idempotency key can be replayed.
 */
export function decideIdempotentReplay(input: {
  existingAmountClp: string | null;
  existingAmountUsd: string;
  request: ParsedPaymentRequestBody;
  priced?: ClpPricingQuote | null;
}): IdempotentReplayDecision {
  const { existingAmountClp, existingAmountUsd, request, priced } = input;
  if (request.amount.kind === "clp") {
    const want = priced?.amountClp ?? request.amount.amountClp;
    if (existingAmountClp != null && existingAmountClp === want) {
      return { action: "replay" };
    }
    // Legacy row without amount_clp: compare derived USDC if available
    if (existingAmountClp == null && priced && existingAmountUsd === priced.amountUsd) {
      return { action: "replay" };
    }
    return {
      action: "conflict",
      error: "Idempotency-Key was already used with a different amount",
      code: "IDEMPOTENCY_CONFLICT",
    };
  }
  if (existingAmountUsd === request.amount.amountUsd) {
    return { action: "replay" };
  }
  return {
    action: "conflict",
    error: "Idempotency-Key was already used with a different amount",
    code: "IDEMPOTENCY_CONFLICT",
  };
}

export type PaymentRequestApiResponse = {
  id: string;
  checkoutUrl: string;
  amountUsd: string;
  amountClp: string | null;
  pricingCurrency: string | null;
  clpPerUsdc: number | null;
  fxSource: string | null;
  reference: string | null;
  providerSessionId: string | null;
  expiresAt: string | null;
  idempotentReplay: boolean;
};

export const CHECKOUT_PERSIST_FAILED_CODE = "CHECKOUT_PERSIST_FAILED";

/** Persist failure must never include checkoutUrl — that is the fail-open QR bug. */
export function checkoutPersistFailureBody(): {
  error: string;
  code: typeof CHECKOUT_PERSIST_FAILED_CODE;
} {
  return {
    error: "Could not save the payment request. No QR was issued.",
    code: CHECKOUT_PERSIST_FAILED_CODE,
  };
}

export function buildPaymentRequestResponse(input: {
  id: string;
  checkoutUrl: string;
  amountUsd: string;
  amountClp?: string | null;
  pricingCurrency?: string | null;
  clpPerUsdc?: number | null;
  fxSource?: string | null;
  reference?: string | null;
  providerSessionId?: string | null;
  expiresAt?: string | null;
  idempotentReplay?: boolean;
}): PaymentRequestApiResponse {
  return {
    id: input.id,
    checkoutUrl: input.checkoutUrl,
    amountUsd: input.amountUsd,
    amountClp: input.amountClp ?? null,
    pricingCurrency: input.pricingCurrency ?? null,
    clpPerUsdc: input.clpPerUsdc ?? null,
    fxSource: input.fxSource ?? null,
    reference: input.reference ?? null,
    providerSessionId: input.providerSessionId ?? null,
    expiresAt: input.expiresAt ?? null,
    idempotentReplay: input.idempotentReplay ?? false,
  };
}
