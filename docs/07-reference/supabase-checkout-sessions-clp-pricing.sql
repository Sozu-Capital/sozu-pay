-- CLP pricing metadata on checkout_sessions (Instawards Week 2 POS).
-- Merchants enter whole CLP; amount_usd remains the USDC/Testnet settlement equivalent.

ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS amount_clp TEXT;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS pricing_currency TEXT;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS fx_rate_clp_per_usdc NUMERIC;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS fx_source TEXT;

COMMENT ON COLUMN checkout_sessions.amount_clp IS 'Merchant-facing whole CLP amount (Chile pilot)';
COMMENT ON COLUMN checkout_sessions.pricing_currency IS 'Display currency for amount_clp (CLP)';
COMMENT ON COLUMN checkout_sessions.fx_rate_clp_per_usdc IS 'CLP per 1 USDC used when deriving amount_usd';
COMMENT ON COLUMN checkout_sessions.fx_source IS 'Where fx_rate_clp_per_usdc came from (env / Frankfurter / fallback)';
