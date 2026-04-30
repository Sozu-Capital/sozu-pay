import { NextRequest, NextResponse } from "next/server";
import { getCheckoutSession } from "@/lib/db/checkout-sessions";

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

  return NextResponse.json({
    id: cs.id,
    status: cs.status,
    amountUsd: cs.amount_usd,
    reference: cs.reference,
    createdAt: cs.created_at,
  });
}
