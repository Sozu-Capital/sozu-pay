import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { rpcFulfillWithdrawalRequest } from "@/lib/db/shadow-ledger";

function isAdmin(level: string) {
  return level === "admin" || level === "super_admin";
}

/** POST /api/admin/shadow-ledger/withdrawals/fulfill — body: { requestId: string } */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await getUserBySessionId(session.id);
  if (!currentUser || !isAdmin(currentUser.admin_level)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  if (!requestId) {
    return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
  }

  const result = await rpcFulfillWithdrawalRequest(requestId, currentUser.id);
  if (!result.ok) {
    if (result.error === "not_found") {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (result.error === "invalid_status") {
      return NextResponse.json({ error: "Not pending", status: result.status }, { status: 409 });
    }
    if (result.error === "insufficient_ledger_balance") {
      return NextResponse.json({ error: "Insufficient ledger balance" }, { status: 400 });
    }
    return NextResponse.json({ error: result.error ?? "Fulfill failed" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    debitedUsdcMinor: result.debited_usdc_minor,
    balanceAfterMinor: result.balance_after_minor,
  });
}
