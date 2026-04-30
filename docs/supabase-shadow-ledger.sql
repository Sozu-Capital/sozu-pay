-- Shadow payment rail POC — internal ledger + payment orders + withdrawal queue.
-- Run in Supabase SQL Editor after organizations + users exist.
-- See docs/03-planning/shadow-payment-rail-poc.md

CREATE TABLE IF NOT EXISTS ledger_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stellar_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id)
);

CREATE INDEX IF NOT EXISTS idx_ledger_wallets_org_id ON ledger_wallets(org_id);

CREATE TABLE IF NOT EXISTS ledger_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES ledger_wallets(id) ON DELETE CASCADE,
  asset_code TEXT NOT NULL DEFAULT 'USDC',
  available_minor BIGINT NOT NULL DEFAULT 0,
  pending_withdrawal_minor BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (wallet_id, asset_code)
);

CREATE TABLE IF NOT EXISTS payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_ref TEXT NOT NULL UNIQUE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES ledger_wallets(id) ON DELETE CASCADE,
  amount_clp BIGINT NOT NULL CHECK (amount_clp > 0),
  quoted_usdc_minor BIGINT NOT NULL CHECK (quoted_usdc_minor > 0),
  fx_clp_per_usdc NUMERIC(24, 8) NOT NULL,
  spread_bps INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'awaiting_confirmation', 'confirmed', 'expired', 'cancelled', 'failed')),
  payer_reference TEXT,
  expires_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  confirmed_by_user_id BIGINT REFERENCES users(id),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_org_id ON payment_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_public_ref ON payment_orders(public_ref);

CREATE TABLE IF NOT EXISTS ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES ledger_wallets(id) ON DELETE CASCADE,
  order_id UUID REFERENCES payment_orders(id),
  type TEXT NOT NULL
    CHECK (type IN ('order_credit', 'withdrawal_debit', 'lp_onchain_out', 'adjustment', 'fee')),
  amount_minor BIGINT NOT NULL,
  balance_after_minor BIGINT,
  idempotency_key TEXT UNIQUE,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_transactions_wallet_id ON ledger_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_created_at ON ledger_transactions(created_at DESC);

CREATE TABLE IF NOT EXISTS liquidity_pool_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL DEFAULT 'default',
  stellar_public_key TEXT NOT NULL,
  cached_usdc_minor BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lp_ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES liquidity_pool_accounts(id) ON DELETE CASCADE,
  order_id UUID REFERENCES payment_orders(id),
  amount_minor BIGINT NOT NULL,
  tx_type TEXT NOT NULL,
  stellar_tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES ledger_wallets(id) ON DELETE CASCADE,
  amount_usdc_minor BIGINT NOT NULL CHECK (amount_usdc_minor > 0),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending_ops'
    CHECK (status IN ('pending_ops', 'fulfilled', 'cancelled')),
  requested_by_user_id BIGINT REFERENCES users(id),
  fulfilled_at TIMESTAMPTZ,
  fulfilled_by_user_id BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_org_id ON withdrawal_requests(org_id);

-- Atomic, idempotent confirmation: credits ledger USDC and appends ledger_transactions.
CREATE OR REPLACE FUNCTION confirm_shadow_payment_order(p_order_id UUID, p_confirmed_by BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_order RECORD;
  v_new_balance BIGINT;
BEGIN
  SELECT * INTO v_order FROM payment_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_order.status = 'confirmed' THEN
    RETURN jsonb_build_object('ok', true, 'already_confirmed', true, 'order_id', p_order_id);
  END IF;

  IF v_order.status NOT IN ('pending_payment', 'awaiting_confirmation') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'invalid_status',
      'status', v_order.status
    );
  END IF;

  IF v_order.expires_at IS NOT NULL AND v_order.expires_at < now() THEN
    UPDATE payment_orders
    SET status = 'expired', updated_at = now()
    WHERE id = p_order_id;
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  UPDATE ledger_balances
  SET
    available_minor = available_minor + v_order.quoted_usdc_minor,
    updated_at = now()
  WHERE wallet_id = v_order.wallet_id AND asset_code = 'USDC'
  RETURNING available_minor INTO v_new_balance;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'balance_row_missing');
  END IF;

  UPDATE payment_orders
  SET
    status = 'confirmed',
    confirmed_at = now(),
    confirmed_by_user_id = p_confirmed_by,
    updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO ledger_transactions (
    wallet_id,
    order_id,
    type,
    amount_minor,
    balance_after_minor,
    idempotency_key,
    memo
  ) VALUES (
    v_order.wallet_id,
    p_order_id,
    'order_credit',
    v_order.quoted_usdc_minor,
    v_new_balance,
    'confirm:' || p_order_id::text,
    'Shadow rail: fiat payment confirmed'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'credited_usdc_minor', v_order.quoted_usdc_minor,
    'balance_after_minor', v_new_balance
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', true, 'already_confirmed', true, 'order_id', p_order_id);
END;
$$;

-- Ops fulfills CLP withdrawal: debits ledger USDC after manual CLP sent off-platform.
CREATE OR REPLACE FUNCTION fulfill_shadow_withdrawal_request(p_request_id UUID, p_fulfilled_by BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_req RECORD;
  v_new_balance BIGINT;
BEGIN
  SELECT * INTO v_req FROM withdrawal_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_req.status <> 'pending_ops' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status', 'status', v_req.status);
  END IF;

  SELECT available_minor INTO v_new_balance
  FROM ledger_balances
  WHERE wallet_id = v_req.wallet_id AND asset_code = 'USDC'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'balance_row_missing');
  END IF;

  IF v_new_balance < v_req.amount_usdc_minor THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_ledger_balance');
  END IF;

  UPDATE ledger_balances
  SET
    available_minor = available_minor - v_req.amount_usdc_minor,
    updated_at = now()
  WHERE wallet_id = v_req.wallet_id AND asset_code = 'USDC'
  RETURNING available_minor INTO v_new_balance;

  UPDATE withdrawal_requests
  SET
    status = 'fulfilled',
    fulfilled_at = now(),
    fulfilled_by_user_id = p_fulfilled_by
  WHERE id = p_request_id;

  INSERT INTO ledger_transactions (
    wallet_id,
    order_id,
    type,
    amount_minor,
    balance_after_minor,
    idempotency_key,
    memo
  ) VALUES (
    v_req.wallet_id,
    NULL,
    'withdrawal_debit',
    -v_req.amount_usdc_minor,
    v_new_balance,
    'withdraw:' || p_request_id::text,
    'Shadow rail: withdrawal fulfilled (manual CLP)'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'request_id', p_request_id,
    'debited_usdc_minor', v_req.amount_usdc_minor,
    'balance_after_minor', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_shadow_payment_order(UUID, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION fulfill_shadow_withdrawal_request(UUID, BIGINT) TO service_role;
