import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import {
  createPaymentOrder,
  formatOrderForApi,
  getOrCreateLedgerWallet,
} from "@/lib/db/shadow-ledger";
import { getOrganizationById } from "@/lib/db/organizations";

function isMissingShadowTables(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("ledger_wallets") ||
    msg.includes("payment_orders") ||
    msg.includes("does not exist") ||
    msg.includes("42P01")
  );
}

/**
 * POST /api/payments/create — merchant creates a CLP payment order (shadow rail POC).
 * Body: { amountClp: number, payerReference?: string }
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserBySessionId(session.id);
  if (!user?.org_id) {
    return NextResponse.json({ error: "Organization required" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const amountClp =
    typeof body.amountClp === "number"
      ? body.amountClp
      : typeof body.amountClp === "string"
        ? Number.parseFloat(body.amountClp)
        : NaN;
  if (!Number.isFinite(amountClp) || amountClp <= 0) {
    return NextResponse.json({ error: "Invalid amountClp" }, { status: 400 });
  }

  const payerReference =
    typeof body.payerReference === "string" ? body.payerReference.slice(0, 500) : null;

  try {
    const org = await getOrganizationById(user.org_id);
    const stellar = org?.stellar_disbursement_public_key ?? null;
    const wallet = await getOrCreateLedgerWallet(user.org_id, stellar);
    const order = await createPaymentOrder({
      orgId: user.org_id,
      walletId: wallet.id,
      amountClp,
      payerReference,
    });

    const instructions =
      process.env.SHADOW_PAYMENT_INSTRUCTIONS?.trim() ||
      "Pay the CLP amount via your agreed channel (bank transfer or card). Include the reference code in the memo if possible. Sozu ops will confirm receipt in the dashboard.";

    return NextResponse.json({
      order: formatOrderForApi(order),
      paymentInstructions: instructions,
    });
  } catch (err) {
    if (isMissingShadowTables(err)) {
      return NextResponse.json(
        {
          error: "Shadow ledger not initialized",
          hint: "Run docs/supabase-shadow-ledger.sql in Supabase SQL Editor.",
        },
        { status: 503 }
      );
    }
    console.error("[payments/create]", err);
    return NextResponse.json({ error: "Failed to create payment" }, { status: 500 });
  }
}
