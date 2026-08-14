import { NextRequest, NextResponse } from "next/server";
import {
  getCheckoutSession,
  completeCheckoutSession,
  markCheckoutSessionExpired,
} from "@/lib/db/checkout-sessions";
import { verifyStellarPayment } from "@/lib/checkout/verify-stellar-payment";
import { getAppBaseUrl } from "@/lib/app-url";
import { effectiveCheckoutStatus } from "@/lib/checkout/expiration";

const ALLOWED_ORIGIN = getAppBaseUrl();

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

/**
 * OPTIONS /api/checkout/complete
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

/**
 * POST /api/checkout/complete
 * Complete a checkout session with on-chain Stellar payment verification.
 * Body: { id: "cs_...", transactionHash: "abc...", paymentMethod: "sozu" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, transactionHash, paymentMethod } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400, headers: corsHeaders() }
      );
    }

    if (!transactionHash || typeof transactionHash !== "string") {
      return NextResponse.json(
        { error: "transactionHash is required" },
        { status: 400, headers: corsHeaders() }
      );
    }

    if (paymentMethod !== "sozu" && paymentMethod !== "card" && paymentMethod !== "bank_transfer") {
      return NextResponse.json(
        { error: "Invalid paymentMethod" },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Load session
    const session = await getCheckoutSession(id);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404, headers: corsHeaders() }
      );
    }

    if (session.deleted_at) {
      return NextResponse.json(
        { error: "Session deleted" },
        { status: 410, headers: corsHeaders() }
      );
    }

    // Idempotent: if already completed with same hash, return success
    if (session.status === "completed" && session.stellar_tx_hash === transactionHash) {
      return NextResponse.json(
        { success: true, alreadyCompleted: true },
        { headers: corsHeaders() }
      );
    }

    const status = effectiveCheckoutStatus({
      status: session.status,
      expiresAt: session.expires_at,
    });
    if (status === "expired") {
      if (session.status === "pending") await markCheckoutSessionExpired(session.id);
      return NextResponse.json(
        { error: "Session expired", code: "EXPIRED", status: "expired" },
        { status: 410, headers: corsHeaders() }
      );
    }

    if (status !== "pending") {
      return NextResponse.json(
        { error: `Session is ${status}` },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Verify on-chain payment (only for SOZU rail)
    if (paymentMethod === "sozu") {
      const verification = await verifyStellarPayment(
        transactionHash,
        session.destination_stellar_address,
        session.amount_usd
      );

      if (!verification.success) {
        console.error(
          `[checkout/complete] Verification failed for ${id}:`,
          verification.error
        );
        return NextResponse.json(
          { error: "Payment verification failed", details: verification.error },
          { status: 400, headers: corsHeaders() }
        );
      }
    }

    // Mark session completed
    const updated = await completeCheckoutSession(id, transactionHash, paymentMethod);
    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update session" },
        { status: 500, headers: corsHeaders() }
      );
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (err) {
    console.error("[checkout/complete] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500, headers: corsHeaders() }
    );
  }
}
