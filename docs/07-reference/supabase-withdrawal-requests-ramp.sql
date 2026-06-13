-- Merchant off-ramp (bank withdrawal) requests — ramp / manual CLP POC
-- Separate from shadow-ledger withdrawal_requests if that schema exists elsewhere.

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id TEXT PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount_usd NUMERIC(18, 2) NOT NULL,
  source_stellar_address TEXT NOT NULL,
  bank_account_holder TEXT NOT NULL,
  bank_country TEXT NOT NULL,
  bank_account_number TEXT NOT NULL,
  bank_routing_code TEXT,
  bank_currency TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  provider_withdrawal_id TEXT,
  provider_event_at TIMESTAMPTZ,
  external_ref TEXT NOT NULL,
  estimated_arrival TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_org_id ON withdrawal_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);

COMMENT ON TABLE withdrawal_requests IS 'Store merchant USDC → bank CLP off-ramp queue (manual ops POC)';
