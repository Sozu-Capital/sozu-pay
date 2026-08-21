-- Standing checkouts + store slugs (Named Checkout URLs).
-- Run in Supabase SQL Editor.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS store_slug TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS store_slug_previous TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_store_slug
  ON organizations (store_slug)
  WHERE store_slug IS NOT NULL;

COMMENT ON COLUMN organizations.store_slug IS
  'Public Store slug for /{store-slug} landing and Named Checkout URLs. Prefers Org Sozu tag.';
COMMENT ON COLUMN organizations.store_slug_previous IS
  'Previous Store slug; still redirects to the current store landing.';

CREATE TABLE IF NOT EXISTS standing_checkouts (
  id TEXT PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  checkout_slug TEXT NOT NULL,
  amount_usd TEXT NOT NULL,
  live BOOLEAN NOT NULL DEFAULT true,
  deadline_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, checkout_slug)
);

CREATE INDEX IF NOT EXISTS idx_standing_checkouts_org_id ON standing_checkouts (org_id);
CREATE INDEX IF NOT EXISTS idx_standing_checkouts_slug ON standing_checkouts (org_id, checkout_slug);

COMMENT ON TABLE standing_checkouts IS
  'Standing checkout: durable Named Checkout URL /{store-slug}/{checkout-slug}. Sales do not complete this row.';

ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS standing_checkout_id TEXT;
COMMENT ON COLUMN checkout_sessions.standing_checkout_id IS
  'POS payment attempt minted from a Standing checkout; completing it must not flip the standing row off.';
