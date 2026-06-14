import { NextRequest, NextResponse } from "next/server";
import { rampProvider } from "@/lib/ramp/provider";
import { getSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/ramp
 * Receives provider callbacks for deposit and withdrawal events.
 * Always returns 200 to ACK; errors are logged, not returned.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-ramp-signature") ?? "";

  const event = rampProvider.parseWebhook(rawBody, signature);
  if (!event) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const db = getSupabase();

  try {
    console.log("[webhook/ramp] Processing event:", event.type, "sessionId:", event.sessionId, "externalRef:", event.externalRef);
    
    switch (event.type) {
      case "deposit.completed": {
        if (!event.sessionId) break;
        console.log("[webhook/ramp] deposit.completed - transactionHash:", event.transactionHash, "paymentMethod:", event.paymentMethod);
        
        const updateData: Record<string, unknown> = {
          status: "completed",
          provider_event_at: event.occurredAt,
          updated_at: new Date().toISOString(),
        };
        // Set transaction hash and payment method if available
        if (event.transactionHash) {
          updateData.stellar_tx_hash = event.transactionHash;
        }
        if (event.paymentMethod) {
          updateData.completed_payment_method = event.paymentMethod;
        }
        
        const { data, error } = await db
          .from("checkout_sessions")
          .update(updateData)
          .eq("provider_session_id", event.sessionId)
          .neq("status", "completed") // idempotent: skip if already marked
          .select();
        
        if (error) {
          console.error("[webhook/ramp] DB update error:", error);
        } else {
          console.log("[webhook/ramp] Successfully updated checkout session:", data);
        }
        break;
      }

      case "deposit.failed": {
        if (!event.sessionId) break;
        await db
          .from("checkout_sessions")
          .update({
            status: "failed",
            provider_event_at: event.occurredAt,
            updated_at: new Date().toISOString(),
          })
          .eq("provider_session_id", event.sessionId)
          .eq("status", "pending");
        break;
      }

      case "withdrawal.completed": {
        if (!event.externalRef) break;
        await db
          .from("withdrawal_requests")
          .update({
            status: "completed",
            provider_event_at: event.occurredAt,
            updated_at: new Date().toISOString(),
          })
          .eq("external_ref", event.externalRef)
          .neq("status", "completed");
        break;
      }

      case "withdrawal.failed": {
        if (!event.externalRef) break;
        await db
          .from("withdrawal_requests")
          .update({
            status: "failed",
            provider_event_at: event.occurredAt,
            updated_at: new Date().toISOString(),
          })
          .eq("external_ref", event.externalRef)
          .eq("status", "processing");
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("[webhook/ramp] DB update failed:", err);
    // Still ACK so the provider does not retry infinitely
  }

  return NextResponse.json({ received: true });
}
