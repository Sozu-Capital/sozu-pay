-- Add QR vs NFC channel on merchant payment points (same /pay/qr/{slug} URL)

ALTER TABLE merchant_qr_points
  ADD COLUMN IF NOT EXISTS point_type TEXT NOT NULL DEFAULT 'qr'
  CHECK (point_type IN ('qr', 'nfc'));

COMMENT ON COLUMN merchant_qr_points.point_type IS 'qr = printed QR code, nfc = NFC tag programmed with the same pay URL';
