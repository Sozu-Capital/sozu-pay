-- Standing pizza SKU redeem intents. Never writes checkout_sessions.status = completed.

CREATE TABLE IF NOT EXISTS pizza_redeems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_point_id UUID NOT NULL REFERENCES merchant_qr_points(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  guest_address TEXT NOT NULL,
  store_address TEXT NOT NULL,
  token_id TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 1 CHECK (amount = 1),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'signed', 'submitted', 'failed')),
  tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pizza_redeems_qr_point_id ON pizza_redeems(qr_point_id);
CREATE INDEX IF NOT EXISTS idx_pizza_redeems_org_id ON pizza_redeems(org_id);
CREATE INDEX IF NOT EXISTS idx_pizza_redeems_status ON pizza_redeems(status);

COMMENT ON TABLE pizza_redeems IS 'Standing pizza SKU redeem intents (1 PIZZA to store treasury). Independent of checkout_sessions.';
COMMENT ON COLUMN pizza_redeems.amount IS 'Always 1 whole pizza (PizzaToken 0 decimals)';
COMMENT ON COLUMN pizza_redeems.status IS 'pending | signed | submitted | failed — submitted means treasury credited';
