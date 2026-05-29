import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAuthorized } from "@/lib/auth/disbursement-auth";
import { startDisbursement } from "@/lib/sdp/adminClient";
import {
  consumeSigningSession,
  getSigningSession,
  markSigningSessionVerified,
} from "@/lib/signing-sessions/store";
import { verifyPasskeyAuthorization } from "@/lib/signing-sessions/verify-passkey";
import { appendAuditEvent } from "@/lib/audit";
import { logPasskeyEvent } from "@/lib/passkey/log";

/**
 * POST /api/sdp/disbursements/[id]/start
 * Starts SDP payments after passkey authorization.
 *
 * Body:
 *   sessionId (required)
 *   credentialId + contractId (required for same-device flow; optional if session already verified via QR)
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

  const signingSession = getSigningSession(sessionId);
  if (!signingSession) {
    logPasskeyEvent("warn", {
      action: "start_disbursement",
      userId: auth.user.id,
      disbursementId,
      sessionId,
      reason: "session_not_found",
    });
    return NextResponse.json({ error: "Signing session not found.", code: "SESSION_NOT_FOUND" }, { status: 404 });
  }
  if (signingSession.disbursementId !== disbursementId) {
    return NextResponse.json(
      { error: "Signing session does not match this disbursement.", code: "DISBURSEMENT_MISMATCH" },
      { status: 400 }
    );
  }
  if (signingSession.privyUserId !== session.id) {
    return NextResponse.json({ error: "Forbidden.", code: "SESSION_USER_MISMATCH" }, { status: 403 });
  }

  // Same-device: verify passkey now and mark session verified.
  if (signingSession.status === "pending") {
    if (!credentialId || !contractId) {
      return NextResponse.json(
        {
          error: "Passkey authorization incomplete. Approve with your passkey or scan the QR on a compatible device.",
          code: "PASSKEY_REQUIRED",
        },
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
      logPasskeyEvent("error", {
        action: "start_disbursement",
        userId: auth.user.id,
        disbursementId,
        sessionId,
        reason: verified.code,
        userAgent: request.headers.get("user-agent") ?? undefined,
      });
      return NextResponse.json({ error: verified.error, code: verified.code }, { status: 403 });
    }

    const marked = markSigningSessionVerified(sessionId, { credentialId, contractId });
    if (!marked.ok) {
      return NextResponse.json({ error: marked.error, code: marked.code }, { status: 400 });
    }
  }

  const consumed = consumeSigningSession(sessionId, session.id);
  if (!consumed.ok) {
    logPasskeyEvent("error", {
      action: "start_disbursement",
      userId: auth.user.id,
      disbursementId,
      sessionId,
      reason: consumed.code,
    });
    return NextResponse.json({ error: consumed.error, code: consumed.code }, { status: 400 });
  }

  try {
    await startDisbursement(disbursementId);

    appendAuditEvent(
      "disbursement_started",
      `Batch disbursement "${signingSession.disbursementName}" started (passkey authorized by ${session.email ?? session.id})`,
      session.id,
      {
        signerWallet: consumed.session.contractId,
        amount: signingSession.disbursementSummary.totalAmount,
        destination: disbursementId,
        recipientLabel: signingSession.disbursementName,
      }
    );

    logPasskeyEvent("info", {
      action: "start_disbursement_ok",
      userId: auth.user.id,
      disbursementId,
      sessionId,
      details: {
        contractId: consumed.session.contractId,
        credentialId: consumed.session.credentialId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/sdp/disbursements/[id]/start]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
