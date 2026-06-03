import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAdmin } from "@/lib/auth/disbursement-auth";
import { getDisbursement, listReceivers } from "@/lib/sdp/adminClient";
import { mapReceiverToBeneficiaryRow } from "@/lib/sdp/receiverDisplay";
import {
  getDisbursementAudit,
  getDisbursementMetaAsync,
  syncPaymentAuditEvents,
} from "@/lib/disbursements/store";
import { applyManualPaymentsToBeneficiaryRows } from "@/lib/disbursements/payableReceivers";

/** GET /api/sdp/disbursements/[id]/audit */
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
    const [disbursement, receivers, meta] = await Promise.all([
      getDisbursement(id),
      listReceivers(id),
      getDisbursementMetaAsync(id),
    ]);
    const payments = applyManualPaymentsToBeneficiaryRows(
      receivers.map((r) => mapReceiverToBeneficiaryRow(r, new Map(), new Map())),
      meta?.manualPayments ?? {}
    );
    syncPaymentAuditEvents(
      id,
      payments.map((p) => ({
        id: p.id,
        beneficiary_name: p.beneficiary_name,
        payment_status: p.payment_status,
        stellar_transaction_id: p.stellar_transaction_id,
      }))
    );

    return NextResponse.json({
      meta: meta ?? null,
      disbursement: {
        id: disbursement.id,
        name: disbursement.name,
        status: disbursement.status,
        created_at: disbursement.created_at,
      },
      events: getDisbursementAudit(id),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
