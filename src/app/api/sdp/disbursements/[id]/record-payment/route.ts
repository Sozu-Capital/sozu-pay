import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAdmin } from "@/lib/auth/disbursement-auth";
import { actorLabelFromUser, recordManualDisbursementPayment } from "@/lib/disbursements/store";
import { getUserBySessionId } from "@/lib/db/users";

/**
 * POST /api/sdp/disbursements/[id]/record-payment
 * Persist a passkey-signed Soroban payout against an SDP payment row.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await requireDisbursementAdmin(session.id);
  if (!auth.ok) return auth.response;

  const { id: disbursementId } = await params;
  const body = await request.json().catch(() => ({}));
  const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : "";
  const txHash = typeof body.txHash === "string" ? body.txHash.trim() : "";
  const amount = typeof body.amount === "string" ? body.amount.trim() : "";
  const recipientAddress =
    typeof body.recipientAddress === "string" ? body.recipientAddress.trim() : "";
  const recipientLabel =
    typeof body.recipientLabel === "string" ? body.recipientLabel.trim() : "Beneficiary";

  if (!paymentId || !txHash || !amount || !recipientAddress) {
    return NextResponse.json(
      { error: "paymentId, txHash, amount, and recipientAddress are required." },
      { status: 400 }
    );
  }

  const user = await getUserBySessionId(session.id);
  const label = user ? actorLabelFromUser(user) : session.id;
  recordManualDisbursementPayment(
    disbursementId,
    { userId: session.id, label },
    { paymentId, txHash, amount, recipientAddress, recipientLabel }
  );

  return NextResponse.json({ ok: true, paymentId, txHash });
}
