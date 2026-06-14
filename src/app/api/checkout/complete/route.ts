import { NextRequest, NextResponse } from "next/server";
import { getCheckoutSession, completeCheckoutSession } from "@/lib/db/checkout-sessions";
import { verifyStellarPayment } from "@/lib/checkout/verify-stellar-payment";

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
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    if (!transactionHash || typeof transactionHash !== "string") {
      return NextResponse.json(
        { error: "transactionHash is required" },
        { status: 400 }
      );
    }

    if (paymentMethod !== "sozu" && paymentMethod !== "card" && paymentMethod !== "bank_transfer") {
      return NextResponse.json(
        { error: "Invalid paymentMethod" },
        { status: 400 }
      );
    }

    // Load session
    const session = await getCheckoutSession(id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.deleted_at) {
      return NextResponse.json({ error: "Session deleted" }, { status: 410 });
    }

    // Idempotent: if already completed with same hash, return success
    if (session.status === "completed" && session.stellar_tx_hash === transactionHash) {
      return NextResponse.json({ success: true, alreadyCompleted: true });
    }

    if (session.status !== "pending") {
      return NextResponse.json(
        { error: `Session is ${session.status}` },
        { status: 400 }
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
          { status: 400 }
        );
      }
    }

    // Mark session completed
    const updated = await completeCheckoutSession(id, transactionHash, paymentMethod);
    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[checkout/complete] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
