import { NextRequest, NextResponse } from "next/server";
import { getCheckoutSession, completeCheckoutSession } from "@/lib/db/checkout-sessions";
import { getOrganizationById } from "@/lib/db/organizations";
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
    console.log("[checkout/complete] Loading session:", id);
    const session = await getCheckoutSession(id);
    if (!session) {
      console.error("[checkout/complete] Session not found:", id);
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    console.log("[checkout/complete] Session found:", session.id, "status:", session.status, "destination:", session.destination_stellar_address, "amount:", session.amount_usd);

    if (session.deleted_at) {
      return NextResponse.json({ error: "Session deleted" }, { status: 410 });
    }

    // Idempotent: if already completed with same hash, return success
    if (session.status === "completed" && session.stellar_tx_hash === transactionHash) {
      console.log("[checkout/complete] Already completed with same hash");
      return NextResponse.json({ success: true, alreadyCompleted: true });
    }

    if (session.status !== "pending") {
      console.error("[checkout/complete] Session not pending:", session.status);
      return NextResponse.json(
        { error: `Session is ${session.status}` },
        { status: 400 }
      );
    }

    // Verify on-chain payment (only for SOZU rail)
    if (paymentMethod === "sozu") {
      console.log("[checkout/complete] Verifying SOZU payment, tx:", transactionHash);
      
      // Check against session destination address first
      let verification = await verifyStellarPayment(
        transactionHash,
        session.destination_stellar_address,
        session.amount_usd
      );

      console.log("[checkout/complete] First verification result:", verification.success, !verification.success ? (verification as { success: false; error: string }).error : "success");

      // If verification fails, check against organization's treasury smart account address
      if (!verification.success) {
        console.log("[checkout/complete] First verification failed, checking treasury address");
        const org = await getOrganizationById(session.org_id);
        console.log("[checkout/complete] Org treasury address:", org?.treasury_smart_account_address, "soroban contract:", org?.soroban_contract_id);
        
        if (org?.treasury_smart_account_address) {
          verification = await verifyStellarPayment(
            transactionHash,
            org.treasury_smart_account_address,
            session.amount_usd
          );
          console.log("[checkout/complete] Second verification result:", verification.success, !verification.success ? (verification as { success: false; error: string }).error : "success");
        }
        
        // Also try soroban_contract_id if treasury_smart_account_address is not set or verification failed
        if (!verification.success && org?.soroban_contract_id) {
          verification = await verifyStellarPayment(
            transactionHash,
            org.soroban_contract_id,
            session.amount_usd
          );
          console.log("[checkout/complete] Third verification (soroban_contract_id) result:", verification.success, !verification.success ? (verification as { success: false; error: string }).error : "success");
        }
      }

      if (!verification.success) {
        const errorMsg = (verification as { success: false; error: string }).error;
        console.error(
          `[checkout/complete] All verifications failed for ${id}:`,
          errorMsg
        );
        return NextResponse.json(
          { error: "Payment verification failed", details: errorMsg },
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
