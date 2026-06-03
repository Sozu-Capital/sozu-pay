import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAdmin } from "@/lib/auth/disbursement-auth";
import {
  getDisbursement,
  pauseDisbursement,
} from "@/lib/sdp/adminClient";
import { distributeDisbursementPayments } from "@/lib/sdp/distributePayments";
import {
  actorLabelFromUser,
  appendDisbursementAudit,
  markPaymentsStarted,
} from "@/lib/disbursements/store";
import { getUserBySessionId } from "@/lib/db/users";
import { formatSdpStartError } from "@/lib/sdp/validateDisbursementStart";

type CampaignStatus = "STARTED" | "PAUSED";

/**
 * PATCH /api/sdp/disbursements/[id]/status
 * Toggle campaign between STARTED and PAUSED (admin, no passkey).
 * Body: { status: "STARTED" | "PAUSED" }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await requireDisbursementAdmin(session.id);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const target = body?.status as CampaignStatus | undefined;
  if (target !== "STARTED" && target !== "PAUSED") {
    return NextResponse.json(
      { error: 'status must be "STARTED" or "PAUSED".', code: "INVALID_STATUS" },
      { status: 400 }
    );
  }

  try {
    const disbursement = await getDisbursement(id);
    const current = disbursement.status.toUpperCase();

    if (target === "PAUSED") {
      if (current !== "STARTED") {
        return NextResponse.json(
          { error: "Only a STARTED batch can be paused.", code: "INVALID_TRANSITION" },
          { status: 400 }
        );
      }
      await pauseDisbursement(id);
    } else {
      if (current !== "PAUSED" && current !== "DRAFT" && current !== "READY") {
        return NextResponse.json(
          { error: `Cannot resume batch from status ${current}.`, code: "INVALID_TRANSITION" },
          { status: 400 }
        );
      }
      try {
        await distributeDisbursementPayments(id);
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        const formatted = formatSdpStartError(raw);
        return NextResponse.json({ error: formatted.error, code: formatted.code }, { status: 400 });
      }
    }

    const user = await getUserBySessionId(session.id);
    const label = user ? actorLabelFromUser(user) : session.id;

    if (target === "STARTED" && (current === "DRAFT" || current === "READY" || current === "PAUSED")) {
      markPaymentsStarted(id, { userId: session.id, label }, disbursement.name);
    }

    appendDisbursementAudit(id, {
      action: target === "PAUSED" ? "campaign_paused" : "campaign_resumed",
      actorUserId: session.id,
      actorLabel: label,
      message:
        target === "PAUSED"
          ? "Campaign paused — beneficiary registration and payouts are on hold"
          : "Campaign resumed (STARTED)",
    });

    const updated = await getDisbursement(id);
    return NextResponse.json({ ok: true, status: updated.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/sdp/disbursements/[id]/status]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
