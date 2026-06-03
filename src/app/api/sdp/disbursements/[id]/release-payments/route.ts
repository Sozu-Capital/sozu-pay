import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAdmin } from "@/lib/auth/disbursement-auth";
import { listReceivers, retryFailedPayments } from "@/lib/sdp/adminClient";
import { requireDisbursementOrgAccess } from "@/lib/disbursements/org-scope";

/**
 * POST /api/sdp/disbursements/[id]/release-payments
 * Retry FAILED payments for a STARTED batch (e.g. after distribution was funded).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await requireDisbursementAdmin(session.id);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const orgAccess = await requireDisbursementOrgAccess(id, auth.user.org_id!);
  if (!orgAccess.ok) return orgAccess.response;

  try {
    const receivers = await listReceivers(id);
    const failedIds = receivers
      .map((r) => r.payment)
      .filter((p) => p && p.status?.toUpperCase() === "FAILED")
      .map((p) => p!.id);

    const registeredPending = receivers.filter((r) => {
      const paymentStatus = r.payment?.status?.toUpperCase() ?? "";
      const walletStatus = r.receiver_wallet?.status?.toUpperCase() ?? "";
      return (
        walletStatus === "REGISTERED" &&
        paymentStatus !== "SUCCESS" &&
        paymentStatus !== "FAILED"
      );
    }).length;

    if (failedIds.length === 0) {
      return NextResponse.json({
        ok: true,
        retried: 0,
        registeredPending,
        message:
          registeredPending > 0
            ? "No failed payments to retry. Registered beneficiaries with pending payments are processed automatically by SDP when the distribution account is funded."
            : "No failed payments to retry.",
      });
    }

    await retryFailedPayments(failedIds);

    return NextResponse.json({
      ok: true,
      retried: failedIds.length,
      registeredPending,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/sdp/disbursements/[id]/release-payments]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
