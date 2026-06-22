import { NextRequest, NextResponse } from "next/server";
import { getCheckoutSession } from "@/lib/db/checkout-sessions";
import { getOrganizationById } from "@/lib/db/organizations";

const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_SOZUCREDIT_URL || "https://credit.sozu.capital";

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

  // Return 410 Gone if session is not pending (with status so payer can show receipt)
  if (session.status !== "pending") {
    return NextResponse.json(
      {
        error: "Session not pending",
        status: session.status,
        id: session.id,
        amountUsd: session.amount_usd,
        reference: session.reference,
        createdAt: session.created_at,
        stellarTxHash: session.stellar_tx_hash,
        completedPaymentMethod: session.completed_payment_method,
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
      reference: session.reference,
      merchantName,
      destinationStellarAddress: session.destination_stellar_address,
      allowDebit: session.allow_debit,
      allowCredit: session.allow_credit,
      allowBankTransfer: session.allow_bank_transfer,
      createdAt: session.created_at,
    },
    { headers: corsHeaders() }
  );
}
