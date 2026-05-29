/**
 * Short-lived signing sessions for cross-device passkey authorization.
 * In-memory per process (same pattern as audit log). For multi-instance prod, move to Redis/Supabase.
 */

export type SigningSessionStatus = "pending" | "verified" | "consumed" | "expired";

export type SigningSession = {
  id: string;
  type: "disbursement_start";
  disbursementId: string;
  userId: number;
  privyUserId: string;
  orgId: string;
  status: SigningSessionStatus;
  disbursementName: string;
  disbursementSummary: {
    totalPayments: number;
    totalAmount: string;
    assetCode: string;
  };
  credentialId?: string;
  contractId?: string;
  createdAt: string;
  expiresAt: string;
  verifiedAt?: string;
  consumedAt?: string;
  createdFromUserAgent?: string;
};

const SESSION_TTL_MS = 10 * 60 * 1000;
const sessions = new Map<string, SigningSession>();

function purgeExpired() {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (s.status === "pending" && new Date(s.expiresAt).getTime() < now) {
      sessions.set(id, { ...s, status: "expired" });
    }
  }
}

export function createDisbursementSigningSession(params: {
  disbursementId: string;
  userId: number;
  privyUserId: string;
  orgId: string;
  disbursementName: string;
  disbursementSummary: SigningSession["disbursementSummary"];
  userAgent?: string;
}): SigningSession {
  purgeExpired();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const session: SigningSession = {
    id: crypto.randomUUID(),
    type: "disbursement_start",
    disbursementId: params.disbursementId,
    userId: params.userId,
    privyUserId: params.privyUserId,
    orgId: params.orgId,
    status: "pending",
    disbursementName: params.disbursementName,
    disbursementSummary: params.disbursementSummary,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    createdFromUserAgent: params.userAgent,
  };
  sessions.set(session.id, session);
  return session;
}

export function getSigningSession(sessionId: string): SigningSession | null {
  purgeExpired();
  const s = sessions.get(sessionId);
  if (!s) return null;
  if (s.status === "pending" && new Date(s.expiresAt).getTime() < Date.now()) {
    sessions.set(sessionId, { ...s, status: "expired" });
    return sessions.get(sessionId) ?? null;
  }
  return s;
}

export function markSigningSessionVerified(
  sessionId: string,
  params: { credentialId: string; contractId: string }
): { ok: true; session: SigningSession } | { ok: false; error: string; code: string } {
  const session = getSigningSession(sessionId);
  if (!session) return { ok: false, error: "Signing session not found.", code: "SESSION_NOT_FOUND" };
  if (session.status === "expired") {
    return { ok: false, error: "Signing session expired.", code: "SESSION_EXPIRED" };
  }
  if (session.status === "consumed") {
    return { ok: false, error: "Signing session already used.", code: "SESSION_CONSUMED" };
  }
  if (session.status === "verified") {
    return { ok: true, session };
  }

  const updated: SigningSession = {
    ...session,
    status: "verified",
    credentialId: params.credentialId,
    contractId: params.contractId,
    verifiedAt: new Date().toISOString(),
  };
  sessions.set(sessionId, updated);
  return { ok: true, session: updated };
}

export function consumeSigningSession(
  sessionId: string,
  privyUserId: string
): { ok: true; session: SigningSession } | { ok: false; error: string; code: string } {
  const session = getSigningSession(sessionId);
  if (!session) return { ok: false, error: "Signing session not found.", code: "SESSION_NOT_FOUND" };
  if (session.privyUserId !== privyUserId) {
    return { ok: false, error: "Signing session belongs to another user.", code: "SESSION_USER_MISMATCH" };
  }
  if (session.status === "expired") {
    return { ok: false, error: "Signing session expired.", code: "SESSION_EXPIRED" };
  }
  if (session.status === "consumed") {
    return { ok: false, error: "Signing session already used.", code: "SESSION_CONSUMED" };
  }
  if (session.status !== "verified") {
    return { ok: false, error: "Passkey authorization not completed.", code: "SESSION_NOT_VERIFIED" };
  }

  const updated: SigningSession = {
    ...session,
    status: "consumed",
    consumedAt: new Date().toISOString(),
  };
  sessions.set(sessionId, updated);
  return { ok: true, session: updated };
}
