import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { 
  getCheckoutSession, 
  updateCheckoutSession, 
  softDeleteCheckoutSession 
} from "@/lib/db/checkout-sessions";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * PATCH /api/checkout/[id]
 * Update a pending checkout session (merchant only)
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const user = await getUserBySessionId(session.id);
  const orgId = session.orgId ?? user?.org_id ?? null;
  if (!orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const existing = await getCheckoutSession(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.org_id !== orgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (existing.status !== "pending") {
    return NextResponse.json({ error: "Cannot edit completed or failed session" }, { status: 400 });
  }
  if (existing.deleted_at) {
    return NextResponse.json({ error: "Session deleted" }, { status: 410 });
  }

  const body = await request.json().catch(() => ({}));
  
  const updates: {
    amountUsd?: string;
    reference?: string;
    paymentMethod?: string;
    allowDebit?: boolean;
    allowCredit?: boolean;
    allowBankTransfer?: boolean;
  } = {};

  if (typeof body.amountUsd === "string") {
    const amount = parseFloat(body.amountUsd.trim());
    if (!isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    updates.amountUsd = body.amountUsd.trim();
  }

  if (typeof body.reference === "string") {
    updates.reference = body.reference.trim();
  }

  if (body.paymentMethod === "card" || body.paymentMethod === "bank_transfer") {
    updates.paymentMethod = body.paymentMethod;
  }

  if (typeof body.allowDebit === "boolean") updates.allowDebit = body.allowDebit;
  if (typeof body.allowCredit === "boolean") updates.allowCredit = body.allowCredit;
  if (typeof body.allowBankTransfer === "boolean") updates.allowBankTransfer = body.allowBankTransfer;

  const updated = await updateCheckoutSession(id, orgId, updates);
  if (!updated) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const checkoutUrl = `${baseUrl}/checkout/${updated.id}`;

  return NextResponse.json({
    id: updated.id,
    checkoutUrl,
    amountUsd: updated.amount_usd,
    reference: updated.reference,
    paymentMethod: updated.payment_method,
    allowDebit: updated.allow_debit,
    allowCredit: updated.allow_credit,
    allowBankTransfer: updated.allow_bank_transfer,
  });
}

/**
 * DELETE /api/checkout/[id]
 * Soft-delete a pending checkout session (merchant only)
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const user = await getUserBySessionId(session.id);
  const orgId = session.orgId ?? user?.org_id ?? null;
  if (!orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const existing = await getCheckoutSession(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.org_id !== orgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (existing.status !== "pending") {
    return NextResponse.json({ error: "Cannot delete completed or failed session" }, { status: 400 });
  }
  if (existing.deleted_at) {
    return NextResponse.json({ error: "Already deleted" }, { status: 410 });
  }

  const success = await softDeleteCheckoutSession(id, orgId);
  if (!success) {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
