-- Remember which payment link opened a checkout, so the receipt can load that product photo.

ALTER TABLE checkout_sessions
  ADD COLUMN IF NOT EXISTS source_slug TEXT;

COMMENT ON COLUMN checkout_sessions.source_slug IS
  'Item slug of the standing payment link that opened this checkout.';
