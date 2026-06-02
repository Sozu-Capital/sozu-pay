import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAuthorized } from "@/lib/auth/disbursement-auth";
import { getDisbursement, startDisbursement } from "@/lib/sdp/adminClient";
import {
  consumeSigningSession,
  getSigningSession,
  markSigningSessionVerified,
} from "@/lib/signing-sessions/store";
import { verifyPasskeyAuthorization } from "@/lib/signing-sessions/verify-passkey";
import { appendAuditEvent } from "@/lib/audit";
import {
  actorLabelFromUser,
  getDisbursementMetaAsync,
  markHotlinkCommitted,
  markPaymentsStarted,
} from "@/lib/disbursements/store";
import { logPasskeyEvent } from "@/lib/passkey/log";

/**
 * POST /api/sdp/disbursements/[id]/commit
 * Hotlink: passkey-authorized start — funds available for recipients to claim without further NGO approval.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await requireDisbursementAuthorized(session.id);
  if (!auth.ok) return auth.response;

  const { id: disbursementId } = await params;
  const meta = await getDisbursementMetaAsync(disbursementId);
  if (!meta?.invitesSentAt) {
    return NextResponse.json(
      { error: "Send invite emails before enabling Hotlink.", code: "INVITES_REQUIRED" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const credentialId = typeof body.credentialId === "string" ? body.credentialId.trim() : "";
  const contractId = typeof body.contractId === "string" ? body.contractId.trim() : "";

  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required. Passkey authorization must be completed first.", code: "SESSION_REQUIRED" },
      { status: 400 }
    );
  }

  const signingSession = await getSigningSession(sessionId);
  if (!signingSession || signingSession.disbursementId !== disbursementId) {
    return NextResponse.json({ error: "Signing session not found.", code: "SESSION_NOT_FOUND" }, { status: 404 });
  }
  if (signingSession.privyUserId !== session.id) {
    return NextResponse.json({ error: "Forbidden.", code: "SESSION_USER_MISMATCH" }, { status: 403 });
  }

  if (signingSession.status === "pending") {
    if (!credentialId || !contractId) {
      return NextResponse.json(
        { error: "Passkey authorization incomplete.", code: "PASSKEY_REQUIRED" },
        { status: 403 }
      );
    }
    const verified = await verifyPasskeyAuthorization({
      user: auth.user,
      credentialId,
      contractId,
      disbursementId,
      sessionId,
    });
    if (!verified.ok) {
      return NextResponse.json({ error: verified.error, code: verified.code }, { status: 403 });
    }
    await markSigningSessionVerified(sessionId, { credentialId, contractId });
  }

  const consumed = await consumeSigningSession(sessionId, session.id);
  if (!consumed.ok) {
    return NextResponse.json({ error: consumed.error, code: consumed.code }, { status: 400 });
  }

  const actor = { userId: session.id, label: actorLabelFromUser(auth.user) };

  try {
    const disbursement = await getDisbursement(disbursementId);
    if (disbursement.status === "DRAFT" || disbursement.status === "READY") {
      await startDisbursement(disbursementId);
      markPaymentsStarted(disbursementId, actor, disbursement.name);
    }
    markHotlinkCommitted(disbursementId, actor);

    appendAuditEvent(
      "disbursement_hotlink",
      `Hotlink enabled for "${disbursement.name}" (${actor.label})`,
      session.id,
      { destination: disbursementId, recipientLabel: disbursement.name }
    );

    logPasskeyEvent("info", {
      action: "commit_hotlink_ok",
      userId: auth.user.id,
      disbursementId,
      sessionId,
    });

    return NextResponse.json({ ok: true, hotlink: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/sdp/disbursements/[id]/commit]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
