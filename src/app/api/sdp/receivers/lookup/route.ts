import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAdmin } from "@/lib/auth/disbursement-auth";
import { isSdpConfigured, sdpNotConfiguredMessage } from "@/lib/sdp/env";
import { listDisbursements, listReceivers } from "@/lib/sdp/adminClient";
import { receiverVerificationDob } from "@/lib/sdp/receiverDisplay";

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
  if (!email) {
    return NextResponse.json({ error: "email query param is required" }, { status: 400 });
  }

  try {
    const disbursements = await listDisbursements();
    const hits: Array<{
      disbursementId: string;
      disbursementName: string;
      disbursementStatus: string;
      receiverId: string;
      externalId?: string;
      verificationDob: string;
      walletStatus?: string;
      paymentStatus?: string;
    }> = [];

    for (const d of disbursements) {
      const receivers = await listReceivers(d.id);
      for (const r of receivers) {
        if (r.email?.trim().toLowerCase() !== email) continue;
        hits.push({
          disbursementId: d.id,
          disbursementName: d.name,
          disbursementStatus: d.status,
          receiverId: r.id,
          externalId: r.external_id,
          verificationDob: receiverVerificationDob(r),
          walletStatus: r.receiver_wallet?.status,
          paymentStatus: r.payment?.status,
        });
      }
    }

    const uniqueDobs = [...new Set(hits.map((h) => h.verificationDob).filter(Boolean))];
    const duplicateEmail = hits.length > 1;
    const conflictingDobs = uniqueDobs.length > 1;

    return NextResponse.json({
      email,
      count: hits.length,
      duplicateEmail,
      conflictingDobs,
      uniqueDobs,
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
