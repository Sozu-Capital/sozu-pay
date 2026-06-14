import { NextRequest, NextResponse } from "next/server";
import { getCheckoutSession } from "@/lib/db/checkout-sessions";
import { getOrganizationById } from "@/lib/db/organizations";

/**
 * GET /api/checkout/public?id=cs_...
 * Returns checkout session details for payer UI (SozuCredit).
 * Session ID is the capability token (no additional auth required).
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const session = await getCheckoutSession(id);
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
      { status: 410 }
    );
  }

  if (session.deleted_at) {
    return NextResponse.json({ error: "Session deleted" }, { status: 410 });
  }

  // Fetch merchant name and treasury address
  const org = await getOrganizationById(session.org_id);
  const merchantName = org?.name ?? "Merchant";
  
  // Use treasury smart account address if available, otherwise fall back to destination_stellar_address
  const destinationAddress = org?.treasury_smart_account_address ?? session.destination_stellar_address;

  return NextResponse.json({
    id: session.id,
    status: session.status,
    amountUsd: session.amount_usd,
    reference: session.reference,
    merchantName,
    destinationStellarAddress: destinationAddress,
    organizationId: session.org_id,
    allowDebit: session.allow_debit,
    allowCredit: session.allow_credit,
    allowBankTransfer: session.allow_bank_transfer,
    createdAt: session.created_at,
  });
}
