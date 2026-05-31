-- Organization Sozu Tag (shared Supabase with Sozu Credit / wallet app)
--
-- Goal: allow an organization (store or NGO) to claim a Sozu tag ($username) that other apps can
-- resolve via existing flows:
--   $tag -> profiles.username -> stellar_wallets.public_key (same auth user id)
--
-- Approach: create a dedicated synthetic Supabase auth user per organization and store its id on
-- organizations.sozu_tag_auth_user_id. Then write:
--   profiles.username = org_tag
--   stellar_wallets.public_key = org treasury smart account (C…) when deployed, else classic G.
--
-- This keeps org tags separate from human members' personal profiles/tags.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS sozu_tag_auth_user_id UUID UNIQUE;

COMMENT ON COLUMN organizations.sozu_tag_auth_user_id IS
  'Supabase auth.users.id used to back the org Sozu tag (profiles.username) + stellar_wallets row.';

-- Optional FK (enable when you are ready to enforce it):
-- ALTER TABLE organizations
--   ADD CONSTRAINT fk_organizations_sozu_tag_auth_user
--   FOREIGN KEY (sozu_tag_auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Notes:
-- - Many projects already enforce unique usernames; if not, consider:
--   CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (lower(username));
--
-- - The stellar_wallets schema varies by project. This dashboard defaults to columns:
--     stellar_wallets.user_id (UUID) and stellar_wallets.public_key (TEXT)
--   If yours differs, configure env overrides in the dashboard:
--     SOZUPAY_STELLAR_WALLET_USER_ID_COLUMN, SOZUPAY_STELLAR_WALLET_PUBLIC_KEY_COLUMN

