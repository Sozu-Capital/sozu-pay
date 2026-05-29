import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getDisbursement, listReceivers } from "@/lib/sdp/adminClient";

/**
 * GET /api/sdp/disbursements/[id] — status, payments (via receivers), tx hashes.
 *
 * SDP v6 has no /disbursements/{id}/payments sub-route. Individual payment
 * records are embedded inside each receiver row returned by
 * GET /disbursements/{id}/receivers. We extract them here so the page
 * can render the same payment table without any API changes.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const [disbursement, receivers] = await Promise.all([
      getDisbursement(id),
      listReceivers(id),
    ]);

    // Extract the embedded payment from each receiver row and shape it
    // to match the SdpPayment interface the dashboard page expects.
    const payments = receivers
      .filter((r) => r.payment != null)
      .map((r) => ({
        id: r.payment!.id,
        amount: r.payment!.amount,
        status: r.payment!.status,
        stellar_transaction_id: r.payment!.stellar_transaction_id ?? null,
        receiver: {
          id: r.id,
          email: r.email,
          phone_number: r.phone_number,
        },
        created_at: r.payment!.created_at ?? "",
      }));

    return NextResponse.json({ disbursement, payments, receivers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/sdp/disbursements/[id] GET]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
