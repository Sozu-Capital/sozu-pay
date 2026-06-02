import { getSupabase } from "@/lib/supabase/server";
import type { SigningSession, SigningSessionStatus } from "@/lib/signing-sessions/store";

type SessionRow = {
  id: string;
  disbursement_id: string;
  user_id: number;
  privy_user_id: string;
  org_id: string;
  status: SigningSessionStatus;
  disbursement_name: string;
  disbursement_summary: SigningSession["disbursementSummary"];
  credential_id: string | null;
  contract_id: string | null;
  created_at: string;
  expires_at: string;
  verified_at: string | null;
  consumed_at: string | null;
  created_from_user_agent: string | null;
};

function rowToSession(row: SessionRow): SigningSession {
  return {
    id: row.id,
    type: "disbursement_start",
    disbursementId: row.disbursement_id,
    userId: row.user_id,
    privyUserId: row.privy_user_id,
    orgId: row.org_id,
    status: row.status,
    disbursementName: row.disbursement_name,
    disbursementSummary: row.disbursement_summary,
    credentialId: row.credential_id ?? undefined,
    contractId: row.contract_id ?? undefined,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    verifiedAt: row.verified_at ?? undefined,
    consumedAt: row.consumed_at ?? undefined,
    createdFromUserAgent: row.created_from_user_agent ?? undefined,
  };
}

function sessionToRow(session: SigningSession): SessionRow {
  return {
    id: session.id,
    disbursement_id: session.disbursementId,
    user_id: session.userId,
    privy_user_id: session.privyUserId,
    org_id: session.orgId,
    status: session.status,
    disbursement_name: session.disbursementName,
    disbursement_summary: session.disbursementSummary,
    credential_id: session.credentialId ?? null,
    contract_id: session.contractId ?? null,
    created_at: session.createdAt,
    expires_at: session.expiresAt,
    verified_at: session.verifiedAt ?? null,
    consumed_at: session.consumedAt ?? null,
    created_from_user_agent: session.createdFromUserAgent ?? null,
  };
}

export async function insertSigningSession(session: SigningSession): Promise<void> {
  const { error } = await getSupabase()
    .from("disbursement_signing_sessions")
    .insert(sessionToRow(session));
  if (error) throw new Error(error.message);
}

export async function fetchSigningSession(sessionId: string): Promise<SigningSession | null> {
  const { data, error } = await getSupabase()
    .from("disbursement_signing_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowToSession(data as SessionRow);
}

export async function updateSigningSession(session: SigningSession): Promise<void> {
  const { error } = await getSupabase()
    .from("disbursement_signing_sessions")
    .update(sessionToRow(session))
    .eq("id", session.id);
  if (error) throw new Error(error.message);
}
