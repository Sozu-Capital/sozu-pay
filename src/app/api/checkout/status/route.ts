import { NextRequest, NextResponse } from "next/server";
import {
  getCheckoutSession,
  markCheckoutSessionExpired,
} from "@/lib/db/checkout-sessions";
import { effectiveCheckoutStatus } from "@/lib/checkout/expiration";

/**
 * GET /api/checkout/status?id=cs_...
 * Returns the current status of a checkout session (public endpoint — session ID is the auth token).
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const cs = await getCheckoutSession(id);
  if (!cs) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const status = effectiveCheckoutStatus({
    status: cs.status,
    expiresAt: cs.expires_at,
  });
  if (status === "expired" && cs.status === "pending") {
    await markCheckoutSessionExpired(cs.id);
  }

  return NextResponse.json({
    id: cs.id,
    status,
    amountUsd: cs.amount_usd,
    amountClp: cs.amount_clp,
    reference: cs.reference,
    createdAt: cs.created_at,
    expiresAt: cs.expires_at,
    stellarTxHash: cs.stellar_tx_hash,
    completedPaymentMethod: cs.completed_payment_method,
  });
}
