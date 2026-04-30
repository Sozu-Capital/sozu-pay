-- Smart accounts + WebAuthn credentials (OpenZeppelin smart accounts integration).
-- Run after organizations + users tables exist.

-- WebAuthn credentials registered by users (passkeys).
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  -- WebAuthn credential ID (opaque bytes), stored as base64url.
  credential_id TEXT NOT NULL,
  -- 65-byte uncompressed secp256r1 public key, stored as base64url.
  public_key_65b TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user_id ON webauthn_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_org_id ON webauthn_credentials(org_id);

-- Smart accounts deployed per org treasury and per member.
CREATE TABLE IF NOT EXISTS smart_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('org_treasury', 'member')),
  contract_id TEXT NOT NULL, -- C...
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, type),
  UNIQUE (org_id, user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_smart_accounts_org_id ON smart_accounts(org_id);
CREATE INDEX IF NOT EXISTS idx_smart_accounts_user_id ON smart_accounts(user_id);

-- Organization member invitations (email-based) + desired role.
CREATE TABLE IF NOT EXISTS org_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin', 'guardian', 'treasury_manager')),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, email)
);

CREATE INDEX IF NOT EXISTS idx_org_invites_org_id ON org_invites(org_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_token ON org_invites(token);

