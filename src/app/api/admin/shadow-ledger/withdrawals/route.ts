import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserByPrivyId } from "@/lib/db/users";
import { listPendingWithdrawalsForAdmin } from "@/lib/db/shadow-ledger";
import { usdcMinorToDisplayString } from "@/lib/shadow-ledger-quote";

function isAdmin(level: string) {
  return level === "admin" || level === "super_admin";
}

/** GET /api/admin/shadow-ledger/withdrawals — pending CLP withdrawal queue. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await getUserByPrivyId(session.id);
  if (!currentUser || !isAdmin(currentUser.admin_level)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const rows = await listPendingWithdrawalsForAdmin(200);
    return NextResponse.json({
      withdrawals: rows.map((w) => ({
        id: w.id,
        orgId: w.org_id,
        amountUsdc: usdcMinorToDisplayString(BigInt(w.amount_usdc_minor)),
        amountUsdcMinor: String(w.amount_usdc_minor),
        note: w.note,
        status: w.status,
        createdAt: w.created_at,
        requestedByUserId: w.requested_by_user_id,
      })),
    });
  } catch (err) {
    console.error("[admin/shadow-ledger/withdrawals]", err);
    return NextResponse.json({ error: "Failed to list withdrawals" }, { status: 500 });
  }
}
