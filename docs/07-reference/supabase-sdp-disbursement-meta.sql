-- SozuPay batch metadata (survives Vercel serverless cold starts).
-- Required for Hotlink / Start payments gating and invite DOB display.

CREATE TABLE IF NOT EXISTS sdp_disbursement_meta (
  disbursement_id text PRIMARY KEY,
  created_at timestamptz,
  created_by_user_id text,
  created_by_label text,
  invites_sent_at timestamptz,
  invites_sent_by text,
  invites_sent_by_label text,
  hotlink_at timestamptz,
  hotlink_by text,
  hotlink_by_label text,
  payments_started_at timestamptz,
  payments_started_by text,
  payments_started_by_label text,
  manual_payments jsonb,
  archived_at timestamptz,
  archive_reason text,
  org_id text,
  archive_snapshot jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Migration for existing deployments:
-- ALTER TABLE sdp_disbursement_meta ADD COLUMN IF NOT EXISTS manual_payments jsonb;
-- ALTER TABLE sdp_disbursement_meta ADD COLUMN IF NOT EXISTS archived_at timestamptz;
-- ALTER TABLE sdp_disbursement_meta ADD COLUMN IF NOT EXISTS archive_reason text;
-- ALTER TABLE sdp_disbursement_meta ADD COLUMN IF NOT EXISTS org_id text;
-- ALTER TABLE sdp_disbursement_meta ADD COLUMN IF NOT EXISTS archive_snapshot jsonb;
-- CREATE INDEX IF NOT EXISTS idx_sdp_disbursement_meta_org ON sdp_disbursement_meta (org_id);

CREATE TABLE IF NOT EXISTS disbursement_signing_sessions (
  id uuid PRIMARY KEY,
  disbursement_id text NOT NULL,
  user_id integer NOT NULL,
  privy_user_id text NOT NULL,
  org_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'verified', 'consumed', 'expired')),
  disbursement_name text NOT NULL,
  disbursement_summary jsonb NOT NULL,
  credential_id text,
  contract_id text,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  consumed_at timestamptz,
  created_from_user_agent text
);

CREATE INDEX IF NOT EXISTS idx_disbursement_signing_sessions_privy
  ON disbursement_signing_sessions (privy_user_id, created_at DESC);
