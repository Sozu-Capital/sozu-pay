-- Merchant POS devices table for point-of-sale and NFC management
-- Create table for POS and NFC device registry

CREATE TABLE IF NOT EXISTS merchant_pos_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('pos', 'nfc')),
  destination_type TEXT NOT NULL CHECK (destination_type IN ('checkout', 'custom_url')),
  destination_ref TEXT,
  is_online BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_merchant_pos_devices_org_id ON merchant_pos_devices(org_id);

-- Comments
COMMENT ON TABLE merchant_pos_devices IS 'Merchant POS and NFC device registry';
COMMENT ON COLUMN merchant_pos_devices.device_type IS 'pos = point-of-sale terminal, nfc = NFC chip/tag';
COMMENT ON COLUMN merchant_pos_devices.destination_type IS 'checkout = link to checkout session, custom_url = external URL';
COMMENT ON COLUMN merchant_pos_devices.destination_ref IS 'Checkout session ID or custom URL';
COMMENT ON COLUMN merchant_pos_devices.is_online IS 'Toggle whether this device is active';
COMMENT ON COLUMN merchant_pos_devices.notes IS 'Optional notes about the device';
