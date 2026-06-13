-- Off-ramp escrow flow: ops marks fiat sent → merchant passkey-releases USDC
-- Same migration as SozuAdmin — shared Supabase project.

ALTER TABLE withdrawal_requests
  ADD COLUMN IF NOT EXISTS fiat_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fiat_sent_by TEXT,
  ADD COLUMN IF NOT EXISTS merchant_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS release_tx_hash TEXT,
  ADD COLUMN IF NOT EXISTS release_destination_address TEXT;
