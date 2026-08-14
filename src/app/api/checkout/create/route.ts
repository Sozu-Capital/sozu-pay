import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { CHECKOUT_NO_SETTLE_TO_ERROR } from "@/lib/checkout/ready";
import { resolveCheckoutSettleToAddress } from "@/lib/checkout/settle-to";
import { createCheckoutSession, expirePendingCheckoutSessionsForOrg } from "@/lib/db/checkout-sessions";
import { syncLiveCheckoutForOrg } from "@/lib/db/merchant-qr-points";
import { checkoutSessionUrl, checkoutSuccessUrl } from "@/lib/checkout-url";
import { rampProvider } from "@/lib/ramp/provider";
import { getUsdToLocalRate } from "@/lib/fx";
import { buildClpPricingQuote } from "@/lib/pos/clp-pricing";

/**
 * POST /api/checkout/create
 * Creates a checkout session: persists to DB, calls ramp provider, returns URL.
 *
 * POS (Chile pilot) may send `amountClp` (whole pesos). The server derives
 * `amountUsd` for USDC/Testnet settlement via {@link buildClpPricingQuote}.
 * Legacy callers may still send `amountUsd` directly.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const amountClpRaw = typeof body.amountClp === "string" ? body.amountClp.trim() : "";
  const amountUsdRaw = typeof body.amountUsd === "string" ? body.amountUsd.trim() : "";
  const reference = typeof body.reference === "string" ? body.reference.trim() : undefined;
  const paymentMethod =
    body.paymentMethod === "card" || body.paymentMethod === "bank_transfer"
      ? body.paymentMethod
      : undefined;
  const allowDebit = typeof body.allowDebit === "boolean" ? body.allowDebit : true;
  const allowCredit = typeof body.allowCredit === "boolean" ? body.allowCredit : true;
  const allowBankTransfer = typeof body.allowBankTransfer === "boolean" ? body.allowBankTransfer : true;

  let amountUsd = amountUsdRaw;
  let amountClp: string | undefined;
  let pricingCurrency: string | undefined;
  let fxRateClpPerUsdc: number | undefined;
  let fxSource: string | undefined;

  if (amountClpRaw) {
    let frankfurterClpPerUsd: number | null = null;
    try {
      const fx = await getUsdToLocalRate();
      if (fx.currency === "CLP" && fx.rate > 0) frankfurterClpPerUsd = fx.rate;
    } catch {
      /* quote helper applies fallback */
    }
    const quote = buildClpPricingQuote(amountClpRaw, { frankfurterClpPerUsd });
    if (!quote) {
      return NextResponse.json(
        { error: "amountClp must be a positive whole-peso amount" },
        { status: 400 },
      );
    }
    amountUsd = quote.amountUsd;
    amountClp = quote.amountClp;
    pricingCurrency = quote.currency;
    fxRateClpPerUsdc = quote.clpPerUsdc;
    fxSource = quote.fxSource;
  } else if (!amountUsd || isNaN(parseFloat(amountUsd)) || parseFloat(amountUsd) <= 0) {
    return NextResponse.json(
      { error: "amountClp or amountUsd must be a positive number" },
      { status: 400 },
    );
  }

  const user = await getUserBySessionId(session.id);
  const orgId = session.orgId ?? user?.org_id ?? null;
  if (!orgId) {
    return NextResponse.json({ error: "No organization associated with this account" }, { status: 403 });
  }

  const org = await getOrganizationForUser(orgId);
  const destinationAddress = org ? resolveCheckoutSettleToAddress(org) : null;

  console.log(
    "[checkout/create] Organization:",
    orgId,
    "type:",
    org?.type,
    "selected destination:",
    destinationAddress,
  );
  if (!destinationAddress) {
    return NextResponse.json(
      {
        error: CHECKOUT_NO_SETTLE_TO_ERROR,
        code: "NO_SETTLE_TO",
        hint:
          "Org treasury must be a real Stellar G or Soroban C — the local Pollar stub wallet cannot receive funding-link deposits.",
      },
      { status: 422 },
    );
  }

  const id = `cs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const redirectUrl = checkoutSuccessUrl(id, request);

  let depositSession;
  try {
    depositSession = await rampProvider.createDepositSession({
      orgId,
      amountUsd,
      destinationStellarAddress: destinationAddress,
      externalRef: id,
      redirectUrl,
      paymentMethod,
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
      reference,
      destinationStellarAddress: destinationAddress,
      providerSessionId: depositSession.sessionId,
      providerUrl: depositSession.url,
      providerExpiresAt: depositSession.expiresAt,
      paymentMethod,
      allowDebit,
      allowCredit,
      allowBankTransfer,
    });
  } catch (err) {
    console.error("[checkout/create] DB persist error:", err);
    // Return the URL anyway so the merchant can still share it; a background job or next call can reconcile
  }

  await expirePendingCheckoutSessionsForOrg(orgId, id);
  await syncLiveCheckoutForOrg(orgId, id);

  const checkoutUrl = checkoutSessionUrl(id, request);

  return NextResponse.json({
    id,
    checkoutUrl,
    amountUsd,
    amountClp: amountClp ?? null,
    pricingCurrency: pricingCurrency ?? null,
    clpPerUsdc: fxRateClpPerUsdc ?? null,
    fxSource: fxSource ?? null,
    reference: reference ?? null,
    providerSessionId: depositSession.sessionId,
    expiresAt: depositSession.expiresAt ?? null,
  });
}
