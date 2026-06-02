import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAdmin } from "@/lib/auth/disbursement-auth";
import { deleteDisbursement, getDisbursement, listReceivers } from "@/lib/sdp/adminClient";
import { mapReceiverToBeneficiaryRow } from "@/lib/sdp/receiverDisplay";
import { resolveBeneficiaryHintsByEmails } from "@/lib/sdp/resolve-beneficiary-hints";
import { resolveAddressesToSozuTags } from "@/lib/payment/resolve-address-to-tag";

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

  const auth = await requireDisbursementAdmin(session.id);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const [disbursement, receivers] = await Promise.all([
      getDisbursement(id),
      listReceivers(id),
    ]);

    const stellarAddresses = receivers
      .map((r) => r.receiver_wallet?.stellar_address?.trim())
      .filter((addr): addr is string => !!addr);
    const receiverEmails = receivers
      .map((r) => r.email?.trim())
      .filter((email): email is string => !!email);

    const [tagByAddress, hintsByEmail] = await Promise.all([
      resolveAddressesToSozuTags(stellarAddresses),
      resolveBeneficiaryHintsByEmails(receiverEmails),
    ]);

    const payments = receivers.map((r) =>
      mapReceiverToBeneficiaryRow(r, tagByAddress, hintsByEmail)
    );

    return NextResponse.json({ disbursement, payments, receivers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/sdp/disbursements/[id] GET]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/** DELETE /api/sdp/disbursements/[id] — remove a DRAFT or READY batch (admin only). */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await requireDisbursementAdmin(session.id);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const deleted = await deleteDisbursement(id);
    return NextResponse.json({ ok: true, disbursement: deleted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/sdp/disbursements/[id] DELETE]", msg);
    const status = /started|cannot delete/i.test(msg) ? 400 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
