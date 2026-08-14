import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";
import {
  CHECKOUT_NO_SETTLE_TO_ERROR,
  CHECKOUT_SETUP_WALLET_PATH,
  isCheckoutSettleReady,
} from "@/lib/checkout/ready";
import { resolveCheckoutSettleToAddress } from "@/lib/checkout/settle-to";
import {
  buildPaymentRequestResponse,
  decideIdempotentReplay,
  parsePaymentRequestBody,
} from "@/lib/checkout/create-payment-request";
import {
  createCheckoutSession,
  expirePendingCheckoutSessionsForOrg,
  getCheckoutSessionByIdempotencyKey,
} from "@/lib/db/checkout-sessions";
import { syncLiveCheckoutForOrg } from "@/lib/db/merchant-qr-points";
import { checkoutSessionUrl, checkoutSuccessUrl } from "@/lib/checkout-url";
import { rampProvider } from "@/lib/ramp/provider";
import { getUsdToLocalRate } from "@/lib/fx";
import { buildClpPricingQuote } from "@/lib/pos/clp-pricing";
import { computeCheckoutExpiresAt } from "@/lib/checkout/expiration";

/**
 * POST /api/checkout/create
 * Merchant payment-request API used by POS (and legacy funding links).
 *
 * - Auth required
 * - POS sends `amountClp` (whole pesos); USDC settlement amount is derived server-side
 * - Idempotency: optional `Idempotency-Key` header (or body `idempotencyKey`)
 *   replays the same pending session when the amount matches; mismatches → 409
 * - Wallet-not-ready → 422 with setup URL (same gate as GET /api/checkout/ready)
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parsePaymentRequestBody(body, request.headers.get("Idempotency-Key"));
  if ("status" in parsed) {
    return NextResponse.json(
      { error: parsed.error, code: parsed.code },
      { status: parsed.status },
    );
  }

  const user = await getUserBySessionId(session.id);
  const orgId = session.orgId ?? user?.org_id ?? null;
  if (!orgId) {
    return NextResponse.json({ error: "No organization associated with this account" }, { status: 403 });
  }

  const org = await getOrganizationForUser(orgId);
  if (!isCheckoutSettleReady(org)) {
    return NextResponse.json(
      {
        error: CHECKOUT_NO_SETTLE_TO_ERROR,
        code: "NO_SETTLE_TO",
        setupUrl: CHECKOUT_SETUP_WALLET_PATH,
        hint:
          "Org treasury must be a real Stellar G or Soroban C — the local Pollar stub wallet cannot receive funding-link deposits.",
      },
      { status: 422 },
    );
  }
  const destinationAddress = resolveCheckoutSettleToAddress(org!);

  let amountUsd: string;
  let amountClp: string | undefined;
  let pricingCurrency: string | undefined;
  let fxRateClpPerUsdc: number | undefined;
  let fxSource: string | undefined;
  let pricedQuote = null as ReturnType<typeof buildClpPricingQuote>;

  if (parsed.amount.kind === "clp") {
    let frankfurterClpPerUsd: number | null = null;
    try {
      const fx = await getUsdToLocalRate();
      if (fx.currency === "CLP" && fx.rate > 0) frankfurterClpPerUsd = fx.rate;
    } catch {
      /* quote helper applies fallback */
    }
    pricedQuote = buildClpPricingQuote(parsed.amount.amountClp, { frankfurterClpPerUsd });
    if (!pricedQuote) {
      return NextResponse.json(
        { error: "amountClp must be a positive whole-peso amount", code: "INVALID_AMOUNT" },
        { status: 400 },
      );
    }
    amountUsd = pricedQuote.amountUsd;
    amountClp = pricedQuote.amountClp;
    pricingCurrency = pricedQuote.currency;
    fxRateClpPerUsdc = pricedQuote.clpPerUsdc;
    fxSource = pricedQuote.fxSource;
  } else {
    amountUsd = parsed.amount.amountUsd;
  }

  if (parsed.idempotencyKey) {
    const existing = await getCheckoutSessionByIdempotencyKey(orgId, parsed.idempotencyKey);
    if (existing) {
      const decision = decideIdempotentReplay({
        existingAmountClp: existing.amount_clp,
        existingAmountUsd: existing.amount_usd,
        request: parsed,
        priced: pricedQuote,
      });
      if (decision.action === "conflict") {
        return NextResponse.json(
          { error: decision.error, code: decision.code },
          { status: 409 },
        );
      }
      if (decision.action === "replay") {
        return NextResponse.json(
          buildPaymentRequestResponse({
            id: existing.id,
            checkoutUrl: checkoutSessionUrl(existing.id, request),
            amountUsd: existing.amount_usd,
            amountClp: existing.amount_clp,
            pricingCurrency: existing.pricing_currency,
            clpPerUsdc: existing.fx_rate_clp_per_usdc,
            fxSource: existing.fx_source,
            reference: existing.reference,
            providerSessionId: existing.provider_session_id,
            expiresAt: existing.expires_at,
            idempotentReplay: true,
          }),
        );
      }
    }
  }

  const id = `cs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const expiresAt = computeCheckoutExpiresAt();
  const redirectUrl = checkoutSuccessUrl(id, request);

  let depositSession;
  try {
    depositSession = await rampProvider.createDepositSession({
      orgId,
      amountUsd,
      destinationStellarAddress: destinationAddress!,
      externalRef: id,
      redirectUrl,
      paymentMethod: parsed.paymentMethod,
    });
  } catch (err) {
    console.error("[checkout/create] ramp provider error:", err);
    return NextResponse.json({ error: "Failed to create deposit session" }, { status: 502 });
  }

  try {
    await createCheckoutSession({
      id,
      orgId,
      amountUsd,
      amountClp,
      pricingCurrency,
      fxRateClpPerUsdc,
      fxSource,
      idempotencyKey: parsed.idempotencyKey,
      reference: parsed.reference,
      destinationStellarAddress: destinationAddress!,
      providerSessionId: depositSession.sessionId,
      providerUrl: depositSession.url,
      providerExpiresAt: depositSession.expiresAt,
      expiresAt,
      paymentMethod: parsed.paymentMethod,
      allowDebit: parsed.allowDebit,
      allowCredit: parsed.allowCredit,
      allowBankTransfer: parsed.allowBankTransfer,
    });
  } catch (err) {
    console.error("[checkout/create] DB persist error:", err);
    // Return the URL anyway so the merchant can still share it; a background job or next call can reconcile
  }

  await expirePendingCheckoutSessionsForOrg(orgId, id);
  await syncLiveCheckoutForOrg(orgId, id);

  return NextResponse.json(
    buildPaymentRequestResponse({
      id,
      checkoutUrl: checkoutSessionUrl(id, request),
      amountUsd,
      amountClp: amountClp ?? null,
      pricingCurrency: pricingCurrency ?? null,
      clpPerUsdc: fxRateClpPerUsdc ?? null,
      fxSource: fxSource ?? null,
      reference: parsed.reference ?? null,
      providerSessionId: depositSession.sessionId,
      expiresAt,
      idempotentReplay: false,
    }),
  );
}
