import { NextRequest, NextResponse } from "next/server";
import {
  getCheckoutSession,
  markCheckoutSessionExpired,
} from "@/lib/db/checkout-sessions";
import { getOrganizationById } from "@/lib/db/organizations";
import { getAppBaseUrl } from "@/lib/app-url";
import { effectiveCheckoutStatus } from "@/lib/checkout/expiration";
import { editionClaimFields } from "@/lib/dashboard/collectible-edition";
import { checkoutOriginFromHeaders, isCollectibleCheckout } from "@/lib/dashboard/payment-link";
import { paymentLinkImageUrl } from "@/lib/dashboard/product-image";
import { getQRPointByOrgAndSlug } from "@/lib/db/merchant-qr-points";
import type { CheckoutSession } from "@/lib/db/checkout-sessions";

const ALLOWED_ORIGIN = getAppBaseUrl();

async function productImageForSession(
  request: NextRequest,
  session: CheckoutSession,
): Promise<string | null> {
  const slug = session.source_slug?.trim();
  if (!slug) return null;
  const point = await getQRPointByOrgAndSlug(session.org_id, slug);
  if (!point?.imageUrl) return null;
  const origin = checkoutOriginFromHeaders(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    request.headers.get("x-forwarded-proto"),
    getAppBaseUrl(request),
  );
  return paymentLinkImageUrl(origin, session.org_id, point.slug);
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

/**
 * OPTIONS /api/checkout/public
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

/**
 * GET /api/checkout/public?id=cs_...
 * Returns checkout session details for payer UI (SozuCredit).
 * Session ID is the capability token (no additional auth required).
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "id is required" },
      { status: 400, headers: corsHeaders() }
    );
  }

  const session = await getCheckoutSession(id);
  if (!session) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: corsHeaders() }
    );
  }

  const status = effectiveCheckoutStatus({
    status: session.status,
    expiresAt: session.expires_at,
  });
  if (status === "expired" && session.status === "pending") {
    await markCheckoutSessionExpired(session.id);
  }

  const productImageUrl = await productImageForSession(request, session);

  // Return 410 Gone if session is not pending (with status so payer can show receipt)
  if (status !== "pending") {
    return NextResponse.json(
      {
        error: status === "expired" ? "Session expired" : "Session not pending",
        status,
        id: session.id,
        amountUsd: session.amount_usd,
        amountClp: session.amount_clp,
        reference: session.reference,
        createdAt: session.created_at,
        expiresAt: session.expires_at,
        stellarTxHash: session.stellar_tx_hash,
        completedPaymentMethod: session.completed_payment_method,
        collectibleReceipt: isCollectibleCheckout(session.fx_source),
        productImageUrl,
        ...editionClaimFields(session.idempotency_key),
      },
      { status: 410, headers: corsHeaders() }
    );
  }

  if (session.deleted_at) {
    return NextResponse.json(
      { error: "Session deleted" },
      { status: 410, headers: corsHeaders() }
    );
  }

  // Fetch merchant name
  const org = await getOrganizationById(session.org_id);
  const merchantName = org?.name ?? "Merchant";

  return NextResponse.json(
    {
      id: session.id,
      status: session.status,
      amountUsd: session.amount_usd,
      amountClp: session.amount_clp,
      reference: session.reference,
      merchantName,
      destinationStellarAddress: session.destination_stellar_address,
      allowDebit: session.allow_debit,
      allowCredit: session.allow_credit,
      allowBankTransfer: session.allow_bank_transfer,
      createdAt: session.created_at,
      expiresAt: session.expires_at,
      collectibleReceipt: isCollectibleCheckout(session.fx_source),
      productImageUrl,
      ...editionClaimFields(session.idempotency_key),
    },
    { headers: corsHeaders() }
  );
}
