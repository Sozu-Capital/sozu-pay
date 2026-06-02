/**
 * Short-lived signing sessions for cross-device passkey authorization.
 * Persisted to Supabase in production (Vercel multi-instance); in-memory fallback for local dev.
 */

import { isSupabaseConfigured } from "@/lib/supabase/server";

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

function expireIfNeeded(session: SigningSession): SigningSession {
  if (session.status === "pending" && new Date(session.expiresAt).getTime() < Date.now()) {
    return { ...session, status: "expired" };
  }
  return session;
}

async function persistSigningSession(session: SigningSession): Promise<void> {
  sessions.set(session.id, session);
  if (!isSupabaseConfigured()) return;
  try {
    const { insertSigningSession, updateSigningSession, fetchSigningSession } = await import(
      "@/lib/db/signing-sessions"
    );
    const existing = await fetchSigningSession(session.id);
    if (existing) {
      await updateSigningSession(session);
    } else {
      await insertSigningSession(session);
    }
  } catch (e) {
    console.warn("[signing-sessions/store] Supabase persist failed:", e);
  }
}

export async function createDisbursementSigningSession(params: {
  disbursementId: string;
  userId: number;
  privyUserId: string;
  orgId: string;
  disbursementName: string;
  disbursementSummary: SigningSession["disbursementSummary"];
  userAgent?: string;
}): Promise<SigningSession> {
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
  await persistSigningSession(session);
  return session;
}

export async function getSigningSession(sessionId: string): Promise<SigningSession | null> {
  purgeExpired();

  if (isSupabaseConfigured()) {
    try {
      const { fetchSigningSession } = await import("@/lib/db/signing-sessions");
      const fromDb = await fetchSigningSession(sessionId);
      if (fromDb) {
        const session = expireIfNeeded(fromDb);
        sessions.set(sessionId, session);
        if (session.status === "expired" && fromDb.status === "pending") {
          await persistSigningSession(session);
        }
        return session;
      }
    } catch (e) {
      console.warn("[signing-sessions/store] Supabase load failed:", e);
    }
  }

  const s = sessions.get(sessionId);
  if (!s) return null;
  const session = expireIfNeeded(s);
  if (session.status !== s.status) {
    sessions.set(sessionId, session);
    void persistSigningSession(session);
  }
  return session;
}

export async function markSigningSessionVerified(
  sessionId: string,
  params: { credentialId: string; contractId: string }
): Promise<{ ok: true; session: SigningSession } | { ok: false; error: string; code: string }> {
  const session = await getSigningSession(sessionId);
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
  await persistSigningSession(updated);
  return { ok: true, session: updated };
}

export async function consumeSigningSession(
  sessionId: string,
  privyUserId: string
): Promise<{ ok: true; session: SigningSession } | { ok: false; error: string; code: string }> {
  const session = await getSigningSession(sessionId);
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
  await persistSigningSession(updated);
  return { ok: true, session: updated };
}
