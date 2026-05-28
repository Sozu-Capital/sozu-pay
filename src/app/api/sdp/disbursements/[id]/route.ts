import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getDisbursement, listPayments, listReceivers } from "@/lib/sdp/adminClient";

/** GET /api/sdp/disbursements/[id] — status, payments, tx hashes */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const [disbursement, payments, receivers] = await Promise.all([
      getDisbursement(id),
      listPayments(id),
      listReceivers(id),
    ]);
    return NextResponse.json({ disbursement, payments, receivers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/sdp/disbursements/[id] GET]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
