import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAdmin } from "@/lib/auth/disbursement-auth";
import { listDisbursements } from "@/lib/sdp/adminClient";
import {
  getAllDisbursementMetaAsync,
  repairDisbursementMetaOrgIds,
} from "@/lib/disbursements/store";
import {
  getDisbursementHistoryForOrgFromSources,
} from "@/lib/disbursements/org-scope";
import { isSdpConfigured, sdpNotConfiguredMessage } from "@/lib/sdp/env";

export const dynamic = "force-dynamic";

/** GET /api/sdp/disbursements/history — archived deleted/completed/closed batches for current org */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await requireDisbursementAdmin(session.id);
  if (!auth.ok) return auth.response;

  const orgId = auth.user.org_id!;

  if (!isSdpConfigured()) {
    return NextResponse.json({ error: sdpNotConfiguredMessage() }, { status: 503 });
  }

  try {
    const [disbursements, rawMeta] = await Promise.all([
      listDisbursements(),
      getAllDisbursementMetaAsync(),
    ]);
    const meta = await repairDisbursementMetaOrgIds(rawMeta, orgId);
    const history = getDisbursementHistoryForOrgFromSources({
      orgId,
      disbursements,
      metaById: meta,
    });

    return NextResponse.json({ history });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/sdp/disbursements/history GET]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
