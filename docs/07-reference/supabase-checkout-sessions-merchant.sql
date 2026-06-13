-- Checkout sessions merchant enhancements
-- Add payment method options and soft delete support

-- Add payment method columns
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS allow_debit BOOLEAN DEFAULT true;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS allow_credit BOOLEAN DEFAULT true;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS allow_bank_transfer BOOLEAN DEFAULT true;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Index for filtering out deleted sessions
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_deleted_at ON checkout_sessions(org_id, deleted_at) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON COLUMN checkout_sessions.payment_method IS 'Provider payment method: card or bank_transfer';
COMMENT ON COLUMN checkout_sessions.allow_debit IS 'Merchant setting: allow debit cards';
COMMENT ON COLUMN checkout_sessions.allow_credit IS 'Merchant setting: allow credit cards';
COMMENT ON COLUMN checkout_sessions.allow_bank_transfer IS 'Merchant setting: allow bank transfers';
COMMENT ON COLUMN checkout_sessions.deleted_at IS 'Soft delete timestamp';
