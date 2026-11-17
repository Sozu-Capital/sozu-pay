-- One checkout may hold a numbered collectible (edition:{slug}:{number}/{size}).
-- The partial unique index refuses two open sales of the same shirt number.

CREATE UNIQUE INDEX IF NOT EXISTS idx_checkout_sessions_org_idempotency
  ON checkout_sessions (org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;
