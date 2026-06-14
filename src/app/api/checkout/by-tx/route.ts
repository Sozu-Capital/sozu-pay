import { NextRequest, NextResponse } from "next/server";
import { getCheckoutSessionByTxHash, mapCheckoutSessionForApi } from "@/lib/db/checkout-sessions";

/**
 * GET /api/checkout/by-tx?txHash=...
 * Public endpoint to retrieve checkout session details using its Stellar transaction hash.
 */
export async function GET(request: NextRequest) {
  const txHash = request.nextUrl.searchParams.get("txHash");
  if (!txHash) {
    return NextResponse.json({ error: "txHash is required" }, { status: 400 });
  }

  try {
    const session = await getCheckoutSessionByTxHash(txHash);
    if (!session) {
      return NextResponse.json({ error: "Checkout session not found" }, { status: 404 });
    }

    return NextResponse.json(mapCheckoutSessionForApi(session));
  } catch (error) {
    console.error("[api/checkout/by-tx] Error fetching session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
