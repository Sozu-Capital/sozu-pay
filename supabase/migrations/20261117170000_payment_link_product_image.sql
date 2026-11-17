-- Product photo on a standing payment link. The 3D collectible view reads this later.

ALTER TABLE merchant_qr_points
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN merchant_qr_points.image_url IS
  'Optional product photo as a JPEG, PNG, or WebP data URL.';
