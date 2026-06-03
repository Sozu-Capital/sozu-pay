import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAdmin } from "@/lib/auth/disbursement-auth";
import { listDisbursements } from "@/lib/sdp/adminClient";
import {
  archiveCompletedIfNeeded,
  getAllDisbursementMetaAsync,
} from "@/lib/disbursements/store";
import {
  filterDisbursementsForOrg,
  getDisbursementHistoryForOrg,
} from "@/lib/disbursements/org-scope";
import { overlayDisbursementStats } from "@/lib/disbursements/mergeDisbursementStats";
import { isSdpConfigured, sdpNotConfiguredMessage } from "@/lib/sdp/env";

export const dynamic = "force-dynamic";

/** GET /api/sdp/disbursements/history — archived deleted/completed batches for current org */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await requireDisbursementAdmin(session.id);
  if (!auth.ok) return auth.response;

  const orgId = auth.user.org_id!;

  if (isSdpConfigured()) {
    try {
      const [disbursements, meta] = await Promise.all([
        listDisbursements(),
        getAllDisbursementMetaAsync(),
      ]);
      const orgDisbursements = filterDisbursementsForOrg(disbursements, meta, orgId);
      for (const d of orgDisbursements) {
        archiveCompletedIfNeeded({
          disbursement: overlayDisbursementStats(d, meta[d.id]),
        });
      }
    } catch (e) {
      console.warn("[api/sdp/disbursements/history] SDP list failed:", e);
    }
  } else {
    return NextResponse.json({ error: sdpNotConfiguredMessage() }, { status: 503 });
  }

  return NextResponse.json({ history: getDisbursementHistoryForOrg(orgId) });
}
