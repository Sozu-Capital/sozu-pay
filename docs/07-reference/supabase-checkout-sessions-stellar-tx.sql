-- Checkout sessions Stellar transaction support
-- Add columns to track on-chain SOZU payments

-- Add Stellar transaction columns
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS stellar_tx_hash TEXT;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS completed_payment_method TEXT;

-- Index for looking up sessions by transaction hash
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_stellar_tx ON checkout_sessions(stellar_tx_hash) WHERE stellar_tx_hash IS NOT NULL;

-- Comments
COMMENT ON COLUMN checkout_sessions.stellar_tx_hash IS 'Stellar transaction hash for on-chain SOZU payments';
COMMENT ON COLUMN checkout_sessions.completed_payment_method IS 'Payment method used to complete: sozu, card, or bank_transfer';
