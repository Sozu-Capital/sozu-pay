-- Persist single / batch dashboard payouts so history survives serverless restarts.
-- Run in Supabase SQL editor if org_payouts is missing.

CREATE TABLE IF NOT EXISTS org_payouts (
  id TEXT PRIMARY KEY,
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  amount TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('to_bank', 'to_stellar')),
  bank_account_id TEXT,
  stellar_address TEXT,
  recipient_label TEXT,
  stellar_tx_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_payouts_org_created ON org_payouts (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_payouts_user_created ON org_payouts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_payouts_tx_hash ON org_payouts (stellar_tx_hash);

COMMENT ON TABLE org_payouts IS 'Dashboard payout records (Stellar + bank). Replaces in-memory payout store.';
