import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAdmin } from "@/lib/auth/disbursement-auth";
import { listDisbursements } from "@/lib/sdp/adminClient";
import {
  archiveCompletedIfNeeded,
  getDisbursementHistory,
} from "@/lib/disbursements/store";
import { isSdpConfigured, sdpNotConfiguredMessage } from "@/lib/sdp/env";

export const dynamic = "force-dynamic";

/** GET /api/sdp/disbursements/history — archived deleted/completed batches */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await requireDisbursementAdmin(session.id);
  if (!auth.ok) return auth.response;

  if (isSdpConfigured()) {
    try {
      const disbursements = await listDisbursements();
      for (const d of disbursements) {
        archiveCompletedIfNeeded({ disbursement: d });
      }
    } catch (e) {
      console.warn("[api/sdp/disbursements/history] SDP list failed:", e);
    }
  } else {
    return NextResponse.json({ error: sdpNotConfiguredMessage() }, { status: 503 });
  }

  return NextResponse.json({ history: getDisbursementHistory() });
}
