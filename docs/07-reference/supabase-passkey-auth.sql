-- Passkey authentication (replaces Privy for dashboard identity).
-- Run in Supabase SQL Editor after users + smart_accounts tables exist.

ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_pin_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower
  ON users (LOWER(username))
  WHERE username IS NOT NULL;

-- Login passkeys (separate from webauthn_credentials used for Soroban smart-account signing).
CREATE TABLE IF NOT EXISTS auth_passkeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  transports JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  UNIQUE (credential_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_passkeys_user_id ON auth_passkeys(user_id);
