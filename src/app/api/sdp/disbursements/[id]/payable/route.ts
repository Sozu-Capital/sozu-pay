import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAdmin } from "@/lib/auth/disbursement-auth";
import { listReceivers } from "@/lib/sdp/adminClient";
import { getDisbursementMetaAsync } from "@/lib/disbursements/store";
import { listPayableDisbursementReceivers } from "@/lib/disbursements/payableReceivers";

/**
 * GET /api/sdp/disbursements/[id]/payable
 * Registered beneficiaries with pending SDP payments ready for passkey Soroban payout.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await requireDisbursementAdmin(session.id);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const [receivers, meta] = await Promise.all([
      listReceivers(id),
      getDisbursementMetaAsync(id),
    ]);
    const payable = listPayableDisbursementReceivers(receivers, meta?.manualPayments ?? {});
    const totalAmount = payable
      .reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0)
      .toFixed(7)
      .replace(/\.?0+$/, "");

    return NextResponse.json({ payable, count: payable.length, totalAmount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/sdp/disbursements/[id]/payable]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
