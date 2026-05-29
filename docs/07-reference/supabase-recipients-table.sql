-- Recipients table: persisted per owner (session.id = privy_user_id).
-- Run in Supabase SQL Editor if the table does not exist yet.

CREATE TABLE IF NOT EXISTS recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  bank_account_id TEXT NOT NULL DEFAULT '',
  stellar_address TEXT,
  phone TEXT,
  date_of_birth DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- List recipients by owner (dashboard)
CREATE INDEX IF NOT EXISTS idx_recipients_owner_id ON recipients(owner_id);

-- Migration for existing tables:
-- ALTER TABLE recipients ADD COLUMN IF NOT EXISTS phone TEXT;
-- ALTER TABLE recipients ADD COLUMN IF NOT EXISTS date_of_birth DATE;
