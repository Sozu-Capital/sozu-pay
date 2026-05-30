import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import {
  getSigningSession,
  markSigningSessionVerified,
} from "@/lib/signing-sessions/store";
import { verifyPasskeyAuthorization } from "@/lib/signing-sessions/verify-passkey";
import { logPasskeyEvent } from "@/lib/passkey/log";

type RouteParams = { params: Promise<{ sessionId: string }> };

/** GET /api/signing-sessions/[sessionId] — poll authorization status (owner only). */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;
  const signingSession = getSigningSession(sessionId);
  if (!signingSession) {
    return NextResponse.json({ error: "Signing session not found.", code: "SESSION_NOT_FOUND" }, { status: 404 });
  }
  if (signingSession.privyUserId !== session.id) {
    return NextResponse.json({ error: "Forbidden.", code: "SESSION_USER_MISMATCH" }, { status: 403 });
  }

  return NextResponse.json({
    sessionId: signingSession.id,
    status: signingSession.status,
    expiresAt: signingSession.expiresAt,
    verifiedAt: signingSession.verifiedAt ?? null,
    disbursement: {
      id: signingSession.disbursementId,
      name: signingSession.disbursementName,
      ...signingSession.disbursementSummary,
    },
  });
}

/**
 * POST /api/signing-sessions/[sessionId]/complete
 * Complete passkey authorization (local or cross-device).
 * Body: { credentialId, contractId }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserBySessionId(session.id);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;
  const signingSession = getSigningSession(sessionId);
  if (!signingSession) {
    logPasskeyEvent("warn", {
      action: "complete_session",
      userId: user.id,
      sessionId,
      reason: "session_not_found",
    });
    return NextResponse.json({ error: "Signing session not found.", code: "SESSION_NOT_FOUND" }, { status: 404 });
  }
  if (signingSession.privyUserId !== session.id) {
    logPasskeyEvent("warn", {
      action: "complete_session",
      userId: user.id,
      sessionId,
      reason: "session_user_mismatch",
    });
    return NextResponse.json({ error: "Forbidden.", code: "SESSION_USER_MISMATCH" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const credentialId = typeof body.credentialId === "string" ? body.credentialId.trim() : "";
  const contractId = typeof body.contractId === "string" ? body.contractId.trim() : "";

  if (!credentialId || !contractId) {
    return NextResponse.json(
      { error: "credentialId and contractId are required.", code: "MISSING_FIELDS" },
      { status: 400 }
    );
  }

  const verified = await verifyPasskeyAuthorization({
    user,
    credentialId,
    contractId,
    disbursementId: signingSession.disbursementId,
    sessionId,
  });
  if (!verified.ok) {
    logPasskeyEvent("error", {
      action: "complete_session",
      userId: user.id,
      sessionId,
      disbursementId: signingSession.disbursementId,
      reason: verified.code,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    return NextResponse.json({ error: verified.error, code: verified.code }, { status: 403 });
  }

  const marked = markSigningSessionVerified(sessionId, { credentialId, contractId });
  if (!marked.ok) {
    logPasskeyEvent("error", {
      action: "complete_session",
      userId: user.id,
      sessionId,
      reason: marked.code,
    });
    return NextResponse.json({ error: marked.error, code: marked.code }, { status: 400 });
  }

  logPasskeyEvent("info", {
    action: "complete_session_ok",
    userId: user.id,
    sessionId,
    disbursementId: signingSession.disbursementId,
    userAgent: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({
    ok: true,
    sessionId,
    status: marked.session.status,
    verifiedAt: marked.session.verifiedAt,
  });
}
