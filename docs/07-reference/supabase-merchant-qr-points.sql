-- Merchant QR points table for in-store payment acceptance
-- Create table for QR code devices/points of sale

CREATE TABLE IF NOT EXISTS merchant_qr_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  destination_type TEXT NOT NULL CHECK (destination_type IN ('checkout', 'custom_url', 'pizza_sku')),
  destination_ref TEXT,
  is_online BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_merchant_qr_points_org_id ON merchant_qr_points(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_qr_points_slug ON merchant_qr_points(slug);

-- Comments
COMMENT ON TABLE merchant_qr_points IS 'Merchant QR code payment points for in-store/online checkout';
COMMENT ON COLUMN merchant_qr_points.slug IS 'Unique slug for the public pay URL (/pay/qr/{slug})';
COMMENT ON COLUMN merchant_qr_points.destination_type IS 'checkout = live checkout session; custom_url = external URL; pizza_sku = standing Margherita redeem (no checkout_session)';
COMMENT ON COLUMN merchant_qr_points.destination_ref IS 'Checkout session ID or custom URL';
COMMENT ON COLUMN merchant_qr_points.is_online IS 'Toggle whether this QR point is active';
