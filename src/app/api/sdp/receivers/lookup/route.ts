import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAdmin } from "@/lib/auth/disbursement-auth";
import { isSdpConfigured, sdpNotConfiguredMessage } from "@/lib/sdp/env";
import { listDisbursements, listReceivers } from "@/lib/sdp/adminClient";
import { receiverVerificationDob } from "@/lib/sdp/receiverDisplay";
import {
  filterDisbursementsForOrg,
} from "@/lib/disbursements/org-scope";
import { getAllDisbursementMetaAsync } from "@/lib/disbursements/store";

/**
 * GET /api/sdp/receivers/lookup?email=user@example.com
 * Lists every disbursement row for an email (DOB shown per batch).
 * Use to debug SDP verify failures when SozuCredit sends the correct ISO date.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await requireDisbursementAdmin(session.id);
  if (!auth.ok) return auth.response;

  if (!isSdpConfigured()) {
    return NextResponse.json({ error: sdpNotConfiguredMessage() }, { status: 503 });
  }

  const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase();
  const sep24TransactionId =
    new URL(request.url).searchParams.get("tx")?.trim() ||
    new URL(request.url).searchParams.get("sep24TransactionId")?.trim() ||
    "";
  if (!email) {
    return NextResponse.json({ error: "email query param is required" }, { status: 400 });
  }

  try {
    const [disbursements, meta] = await Promise.all([
      listDisbursements(),
      getAllDisbursementMetaAsync(),
    ]);
    const orgId = auth.user.org_id!;
    const scoped = filterDisbursementsForOrg(disbursements, meta, orgId);
    const hits: Array<{
      disbursementId: string;
      disbursementName: string;
      disbursementStatus: string;
      receiverId: string;
      externalId?: string;
      verificationDob: string;
      walletStatus?: string;
      paymentStatus?: string;
      sep24TransactionId?: string | null;
      matchesCurrentTx?: boolean;
    }> = [];

    for (const d of scoped) {
      const receivers = await listReceivers(d.id);
      for (const r of receivers) {
        if (r.email?.trim().toLowerCase() !== email) continue;
        const sep24Tx = r.receiver_wallet?.sep24_transaction_id ?? null;
        hits.push({
          disbursementId: d.id,
          disbursementName: d.name,
          disbursementStatus: d.status,
          receiverId: r.id,
          externalId: r.external_id,
          verificationDob: receiverVerificationDob(r),
          walletStatus: r.receiver_wallet?.status,
          paymentStatus: r.payment?.status,
          sep24TransactionId: sep24Tx,
          matchesCurrentTx: Boolean(sep24TransactionId && sep24Tx === sep24TransactionId),
        });
      }
    }

    const uniqueDobs = [...new Set(hits.map((h) => h.verificationDob).filter(Boolean))];
    const duplicateEmail = hits.length > 1;
    const conflictingDobs = uniqueDobs.length > 1;

    const transactionHit = sep24TransactionId
      ? hits.find((h) => h.matchesCurrentTx) ?? null
      : null;

    return NextResponse.json({
      email,
      sep24TransactionId: sep24TransactionId || null,
      count: hits.length,
      duplicateEmail,
      conflictingDobs,
      uniqueDobs,
      transactionHit,
      hits,
      sdpVerifyNote:
        hits.length > 1
          ? "SDP verify uses GetByContacts(email) and checks receivers[0] (oldest row). Multiple batches with the same email cause DOB mismatches even when the new CSV is correct."
          : hits.length === 1
            ? "Single batch row — if verify still fails, confirm verificationDob matches what the beneficiary enters exactly."
            : "No receiver found for this email in any disbursement.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/sdp/receivers/lookup]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
