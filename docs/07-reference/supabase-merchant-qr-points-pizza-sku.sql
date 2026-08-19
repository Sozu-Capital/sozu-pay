-- Standing pizza SKU: /pay/qr/{slug} stays a live offer (never completes checkout_sessions).

ALTER TABLE merchant_qr_points
  DROP CONSTRAINT IF EXISTS merchant_qr_points_destination_type_check;

ALTER TABLE merchant_qr_points
  ADD CONSTRAINT merchant_qr_points_destination_type_check
  CHECK (destination_type IN ('checkout', 'custom_url', 'pizza_sku'));

COMMENT ON COLUMN merchant_qr_points.destination_type IS
  'checkout = live checkout session; custom_url = external URL; pizza_sku = standing Margherita redeem (no checkout_session)';
