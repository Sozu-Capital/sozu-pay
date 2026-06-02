-- Uploaded beneficiary DOB per SDP disbursement batch (plaintext for dashboard + invite bd=).
-- SDP admin API returns empty after bcrypt; this table survives Vercel serverless restarts.

CREATE TABLE IF NOT EXISTS sdp_disbursement_verifications (
  disbursement_id text NOT NULL,
  email text NOT NULL,
  date_of_birth text NOT NULL CHECK (date_of_birth ~ '^\d{4}-\d{2}-\d{2}$'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (disbursement_id, email)
);

CREATE INDEX IF NOT EXISTS idx_sdp_disbursement_verifications_disbursement
  ON sdp_disbursement_verifications (disbursement_id);
