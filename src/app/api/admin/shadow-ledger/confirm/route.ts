import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserByPrivyId } from "@/lib/db/users";
import { rpcConfirmPaymentOrder } from "@/lib/db/shadow-ledger";

function isAdmin(level: string) {
  return level === "admin" || level === "super_admin";
}

/** POST /api/admin/shadow-ledger/confirm — body: { orderId: string } */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await getUserByPrivyId(session.id);
  if (!currentUser || !isAdmin(currentUser.admin_level)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  const result = await rpcConfirmPaymentOrder(orderId, currentUser.id);
  if (!result.ok) {
    if (result.error === "not_found") {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (result.error === "expired") {
      return NextResponse.json({ error: "Order expired" }, { status: 410 });
    }
    if (result.error === "invalid_status") {
      return NextResponse.json(
        { error: "Invalid status", status: result.status },
        { status: 409 }
      );
    }
    if (result.error === "balance_row_missing") {
      return NextResponse.json(
        { error: "Ledger balance missing for wallet; check migrations." },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: result.error ?? "Confirm failed" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    alreadyConfirmed: result.already_confirmed === true,
    creditedUsdcMinor: result.credited_usdc_minor,
    balanceAfterMinor: result.balance_after_minor,
    orderId: result.order_id,
  });
}
