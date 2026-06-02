-- Resolved Sozu tags for SDP batch beneficiaries (persist after wallet registration).
CREATE TABLE IF NOT EXISTS sdp_beneficiary_sozu_tags (
  disbursement_id text NOT NULL,
  email text NOT NULL,
  sozu_tag text NOT NULL,
  stellar_address text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (disbursement_id, email)
);

CREATE INDEX IF NOT EXISTS idx_sdp_beneficiary_sozu_tags_disbursement
  ON sdp_beneficiary_sozu_tags (disbursement_id);
