-- Organizations table: one per org; type (store | ngo) drives dashboard skin.
-- Phase 2: soroban_contract_id (C address) used for NGO disbursement when set.
-- Run in Supabase SQL Editor if the table does not exist yet.

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'ngo' CHECK (type IN ('store', 'ngo')),
  stellar_disbursement_public_key TEXT,
  stellar_disbursement_secret_encrypted TEXT,
  soroban_contract_id TEXT,
  -- Synthetic Supabase auth user backing org Sozu tag (profiles.username) + stellar_wallets row.
  sozu_tag_auth_user_id UUID UNIQUE,
  -- OpenZeppelin smart account (passkey) treasury wallet (C address).
  treasury_contract_id TEXT,
  -- Guardian threshold required for recovery/role changes (e.g. 2 means 2-of-N).
  treasury_guardian_threshold INT,
  -- User id (users.id) that is the day-to-day TreasuryManager (single-signer for payouts).
  treasury_manager_user_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- If table already exists, add columns:
-- ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stellar_disbursement_secret_encrypted TEXT;
-- Recovery: optional second ciphertext (encrypted with recovery code) for "forgot payout password" flow.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS recovery_encrypted_secret TEXT;
-- Organization Sozu tag backing auth user.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sozu_tag_auth_user_id UUID UNIQUE;
-- Smart account treasury (passkey-based) fields:
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS treasury_contract_id TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS treasury_guardian_threshold INT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS treasury_manager_user_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(type);

-- users.org_id references organizations.id (as text). Add FK when ready:
-- ALTER TABLE users ADD CONSTRAINT fk_users_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;
