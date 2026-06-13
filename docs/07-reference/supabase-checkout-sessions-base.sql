-- Create checkout_sessions table
-- Base table for merchant payment links and checkout sessions

CREATE TABLE IF NOT EXISTS checkout_sessions (
  id TEXT PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount_usd TEXT NOT NULL,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  destination_stellar_address TEXT NOT NULL,
  provider_session_id TEXT,
  provider_url TEXT,
  provider_event_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_org_id ON checkout_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_status ON checkout_sessions(status);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_created_at ON checkout_sessions(created_at DESC);

-- Comments
COMMENT ON TABLE checkout_sessions IS 'Merchant checkout payment links and sessions';
COMMENT ON COLUMN checkout_sessions.amount_usd IS 'Payment amount in USD';
COMMENT ON COLUMN checkout_sessions.reference IS 'Optional merchant reference (order number, customer name, etc)';
COMMENT ON COLUMN checkout_sessions.status IS 'Payment status: pending, completed, failed, or expired';
COMMENT ON COLUMN checkout_sessions.destination_stellar_address IS 'Stellar address where funds will be sent';
COMMENT ON COLUMN checkout_sessions.provider_session_id IS 'Payment provider session ID (e.g., Ramp)';
COMMENT ON COLUMN checkout_sessions.provider_url IS 'Payment provider checkout URL';
