-- Payment links are scoped to a store: /pay/qr/{store}/{item}.
-- Item slugs can repeat across stores. The store slug is stable once assigned.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug
  ON organizations (slug)
  WHERE slug IS NOT NULL;

COMMENT ON COLUMN organizations.slug IS
  'Public store segment for payment links (/pay/qr/{slug}/{item}).';

DROP INDEX IF EXISTS idx_merchant_qr_points_slug;

CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_qr_points_org_slug
  ON merchant_qr_points (org_id, slug);

COMMENT ON COLUMN merchant_qr_points.slug IS
  'Item slug, unique per store. Public URL is /pay/qr/{store}/{slug}.';
