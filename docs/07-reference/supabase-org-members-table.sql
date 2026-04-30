-- Org members: users can belong to multiple orgs (primary org = users.org_id; additional via org_members).
-- Enables "choose existing org" and "join via referral code". Run in Supabase SQL Editor.

-- Add referral_code to organizations (optional; for join-by-code flow).
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_organizations_referral_code ON organizations(referral_code) WHERE referral_code IS NOT NULL;

-- Org members: (user_id, org_id) unique; role for future RBAC.
CREATE TABLE IF NOT EXISTS org_members (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin', 'owner', 'guardian', 'treasury_manager')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON org_members(org_id);
