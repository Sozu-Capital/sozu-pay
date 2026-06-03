import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAdmin } from "@/lib/auth/disbursement-auth";
import {
  archiveDeletedDisbursement,
  actorLabelFromUser,
} from "@/lib/disbursements/store";
import { getUserBySessionId } from "@/lib/db/users";
import { deleteDisbursement, getDisbursement, listReceivers } from "@/lib/sdp/adminClient";
import { mapReceiverToBeneficiaryRow } from "@/lib/sdp/receiverDisplay";
import { resolveBeneficiaryHintsByEmails } from "@/lib/sdp/resolve-beneficiary-hints";
import { resolveAddressesToSozuTags } from "@/lib/payment/resolve-address-to-tag";
import {
  getDisbursementMetaAsync,
  mergedUploadedVerificationsAsync,
  syncPaymentAuditEvents,
  maybeArchiveCompletedDisbursement,
} from "@/lib/disbursements/store";
import { applyManualPaymentsToBeneficiaryRows } from "@/lib/disbursements/payableReceivers";
import { overlayDisbursementStats } from "@/lib/disbursements/mergeDisbursementStats";
import { fetchBeneficiarySozuTags, upsertBeneficiarySozuTags } from "@/lib/db/beneficiary-sozu-tags";

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

    const [tagByAddress, hintsByEmail, persistedSozuTagByEmail] = await Promise.all([
      resolveAddressesToSozuTags(stellarAddresses),
      resolveBeneficiaryHintsByEmails(receiverEmails),
      fetchBeneficiarySozuTags(id).catch(() => ({} as Record<string, string>)),
    ]);

    const tagsToPersist: Array<{ email: string; sozuTag: string; stellarAddress?: string | null }> =
      [];
    for (const r of receivers) {
      const emailKey = r.email?.trim().toLowerCase() ?? "";
      if (!emailKey) continue;
      const stellarAddress = r.receiver_wallet?.stellar_address?.trim().toUpperCase() ?? null;
      const hint = hintsByEmail.get(emailKey);
      const fromAddr = stellarAddress ? tagByAddress.get(stellarAddress) : null;
      const tag = fromAddr ?? hint?.sozuTag ?? null;
      if (tag && tag !== persistedSozuTagByEmail[emailKey]) {
        tagsToPersist.push({ email: emailKey, sozuTag: tag, stellarAddress });
      }
    }
    if (tagsToPersist.length > 0) {
      void upsertBeneficiarySozuTags(id, tagsToPersist).catch((e) => {
        console.warn("[api/sdp/disbursements/[id]] tag persist failed:", e);
      });
    }
    const mergedSozuTags = { ...persistedSozuTagByEmail };
    for (const row of tagsToPersist) {
      mergedSozuTags[row.email] = row.sozuTag.replace(/^\$+/, "");
    }

    const meta = await getDisbursementMetaAsync(id);
    const uploadedVerificationByEmail = await mergedUploadedVerificationsAsync(id);

    const payments = applyManualPaymentsToBeneficiaryRows(
      receivers.map((r) =>
        mapReceiverToBeneficiaryRow(
          r,
          tagByAddress,
          hintsByEmail,
          uploadedVerificationByEmail,
          mergedSozuTags
        )
      ),
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

    const overlaidDisbursement = overlayDisbursementStats(disbursement, meta ?? undefined);
    maybeArchiveCompletedDisbursement(disbursement, meta ?? undefined);

    return NextResponse.json({
      disbursement: overlaidDisbursement,
      payments,
      receivers,
      meta: meta ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/sdp/disbursements/[id] GET]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/** DELETE /api/sdp/disbursements/[id] — archive or hard-delete a batch (admin only). */
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
    const existing = await getDisbursement(id);
    const user = await getUserBySessionId(session.id);
    const label = user ? actorLabelFromUser(user) : session.id;
    const canHardDelete = existing.status === "DRAFT" || existing.status === "READY";
    let sdpDeleted = false;

    if (canHardDelete) {
      try {
        await deleteDisbursement(id);
        sdpDeleted = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/started|cannot delete/i.test(msg)) throw e;
      }
    }

    archiveDeletedDisbursement({
      disbursement: existing,
      actor: { userId: session.id, label },
      sdpDeleted,
    });
    return NextResponse.json({ ok: true, archived: true, sdpDeleted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/sdp/disbursements/[id] DELETE]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
