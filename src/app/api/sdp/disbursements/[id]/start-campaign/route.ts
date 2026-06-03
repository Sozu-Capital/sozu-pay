import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAdmin } from "@/lib/auth/disbursement-auth";
import { getDisbursement } from "@/lib/sdp/adminClient";
import { getOrganizationById } from "@/lib/db/organizations";
import { requireDisbursementOrgAccess } from "@/lib/disbursements/org-scope";
import {
  ensureSdpOrgMessagingForExternalInvites,
  startSdpCampaignIfDraft,
} from "@/lib/sdp/org-messaging";
import { formatSdpStartError } from "@/lib/sdp/validateDisbursementStart";

/**
 * POST /api/sdp/disbursements/[id]/start-campaign
 * Moves batch to STARTED after Railway distribution is funded (no SDP invite emails).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await requireDisbursementAdmin(session.id);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const orgAccess = await requireDisbursementOrgAccess(id, auth.user.org_id!);
  if (!orgAccess.ok) return orgAccess.response;

  const org = await getOrganizationById(auth.user.org_id!);
  await ensureSdpOrgMessagingForExternalInvites(org?.name);

  try {
    const disbursement = await getDisbursement(id);
    const result = await startSdpCampaignIfDraft({
      disbursementId: id,
      currentStatus: disbursement.status,
    });
    return NextResponse.json({ ok: true, ...result, status: disbursement.status });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const formatted = formatSdpStartError(raw);
    console.error("[api/sdp/disbursements/[id]/start-campaign]", raw);
    return NextResponse.json({ error: formatted.error, code: formatted.code }, { status: 400 });
  }
}
