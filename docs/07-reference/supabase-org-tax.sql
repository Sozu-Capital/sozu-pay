-- Optional organization tax / legal profile (onboarding "Set tax now").
-- Run in Supabase SQL Editor when ready; createOrganization omits unknown columns until migrated.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tax_entity_type TEXT
  CHECK (tax_entity_type IS NULL OR tax_entity_type IN ('private_company', 'ngo'));

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS legal_name TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS registered_address TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tax_city TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tax_state TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tax_country TEXT;

COMMENT ON COLUMN organizations.tax_entity_type IS
  'Tax classification: private_company or ngo (maps to organizations.type store/ngo).';
