-- CLP pricing metadata on checkout_sessions (Instawards Week 2 POS).
-- Merchants enter whole CLP; amount_usd remains the USDC/Testnet settlement equivalent.

ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS amount_clp TEXT;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS pricing_currency TEXT;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS fx_rate_clp_per_usdc NUMERIC;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS fx_source TEXT;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_checkout_sessions_org_idempotency
  ON checkout_sessions (org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN checkout_sessions.amount_clp IS 'Merchant-facing whole CLP amount (Chile pilot)';
COMMENT ON COLUMN checkout_sessions.pricing_currency IS 'Display currency for amount_clp (CLP)';
COMMENT ON COLUMN checkout_sessions.fx_rate_clp_per_usdc IS 'CLP per 1 USDC used when deriving amount_usd';
COMMENT ON COLUMN checkout_sessions.fx_source IS 'Where fx_rate_clp_per_usdc came from (env / Frankfurter / fallback)';
COMMENT ON COLUMN checkout_sessions.idempotency_key IS 'Optional client Idempotency-Key for safe POS retries';

-- Explicit payment TTL (Instawards Week 2 expiration)
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
COMMENT ON COLUMN checkout_sessions.expires_at IS 'When a pending payment request stops being payable';
