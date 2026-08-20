import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireTreasuryOwnerConfirm } from "@/lib/auth/disbursement-auth";
import { getSpendRequest } from "@/lib/disbursements/spend-requests";
import { approveQueuedOrgSpend } from "@/lib/disbursements/org-spend";
import { recordManualDisbursementPaymentAsync } from "@/lib/disbursements/store";
import { getOrgMember } from "@/lib/db/org-members";

/**
 * POST /api/disbursements/org-spend/[id]/approve
 * Treasury owner approves a queued spend and executes via Org spend executor.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await requireTreasuryOwnerConfirm(session.id);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const spendRequest = getSpendRequest(id);
  if (!spendRequest || spendRequest.orgId !== auth.org.id) {
    return NextResponse.json({ error: "Spend request not found" }, { status: 404 });
  }

  try {
    const result = await approveQueuedOrgSpend({
      org: auth.org,
      user: auth.user,
      spendRequest,
      memberRole: (await getOrgMember(auth.user.id, auth.org.id))?.role,
    });

    for (let i = 0; i < spendRequest.payments.length; i++) {
      const p = spendRequest.payments[i]!;
      const txHash = result.txHashes[i] ?? result.txHashes[0]!;
      await recordManualDisbursementPaymentAsync(
        spendRequest.disbursementId,
        {
          userId: String(auth.user.id),
          label: result.spendRequest.approvedByLabel ?? result.spendRequest.requestedByLabel,
        },
        {
          paymentId: p.paymentId,
          txHash,
          amount: p.amount,
          recipientAddress: p.toAddress,
          recipientLabel: p.recipientLabel ?? p.toAddress,
        },
      );
    }

    return NextResponse.json({
      outcome: "executed",
      spendRequestId: result.spendRequest.id,
      txHashes: result.txHashes,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Approve failed";
    const status = /treasury owner/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
