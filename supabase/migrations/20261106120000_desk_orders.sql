-- P2P cash-out desk (ADR 0003, szp #91–#93). Shared by sozu-pay and sozu-wallet.
-- Additive only: new tables, functions, indexes, trigger. Nothing existing is altered.
-- RLS on with no policies: only server routes using the service role touch these tables.

CREATE TABLE IF NOT EXISTS public.desk_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Wallet session user id (same id space as ramp_orders.user_id).
  user_id text NOT NULL,
  -- Her OpenZeppelin smart account. Lock `from` and refund destination.
  smart_account text NOT NULL CHECK (smart_account ~ '^C[A-Z2-7]{55}$'),
  -- The escrow G the lock was built to. Release/refund refuse if the dashboard's escrow key differs.
  escrow_address text NOT NULL CHECK (escrow_address ~ '^G[A-Z2-7]{55}$'),
  -- USDC minor units (1 USDC = 10_000_000).
  usdc_minor bigint NOT NULL CHECK (usdc_minor > 0),
  ars_cents bigint NOT NULL CHECK (ars_cents > 0),
  -- ARS per 1 USDC.
  rate numeric(20, 6) NOT NULL CHECK (rate > 0),
  rate_source text NOT NULL,
  rate_at timestamptz NOT NULL,
  -- CBU, CVU, or alias. She attests it is in her own name.
  bank_alias text NOT NULL CHECK (length(bank_alias) BETWEEN 6 AND 64),
  bank_alias_attested_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','locked','paid','releasing','released','refunding','refunded','disputed','expired')),
  lock_hash text,
  locked_at timestamptz,
  pay_deadline timestamptz,
  paid_at timestamptz,
  bank_ref text,
  paid_by text,
  confirm_deadline timestamptz,
  confirmed_at timestamptz,
  release_hash text,
  refund_hash text,
  closed_at timestamptz,
  dispute_note text,
  witness_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- An order is released or refunded, never both.
  CONSTRAINT desk_orders_release_xor_refund CHECK (release_hash IS NULL OR refund_hash IS NULL),
  CONSTRAINT desk_orders_released_has_hash CHECK (status <> 'released' OR release_hash IS NOT NULL),
  CONSTRAINT desk_orders_refunded_has_hash CHECK (status <> 'refunded' OR refund_hash IS NOT NULL),
  CONSTRAINT desk_orders_paid_has_ref CHECK (paid_at IS NULL OR (bank_ref IS NOT NULL AND length(bank_ref) > 0))
);

CREATE UNIQUE INDEX IF NOT EXISTS desk_orders_lock_hash_uniq ON public.desk_orders (lock_hash) WHERE lock_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS desk_orders_release_hash_uniq ON public.desk_orders (release_hash) WHERE release_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS desk_orders_refund_hash_uniq ON public.desk_orders (refund_hash) WHERE refund_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS desk_orders_status_idx ON public.desk_orders (status, created_at);
CREATE INDEX IF NOT EXISTS desk_orders_user_idx ON public.desk_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS desk_orders_smart_account_idx ON public.desk_orders (smart_account);

CREATE TABLE IF NOT EXISTS public.desk_order_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.desk_orders (id),
  from_status text,
  to_status text NOT NULL,
  -- 'wallet:<user_id>', 'dashboard:<email>', or 'sweep'.
  actor text NOT NULL,
  tx_hash text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS desk_order_events_order_idx ON public.desk_order_events (order_id, id);

ALTER TABLE public.desk_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desk_order_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.desk_orders FROM anon, authenticated;
REVOKE ALL ON public.desk_order_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.desk_order_events_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'desk_order_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS desk_order_events_no_update ON public.desk_order_events;
CREATE TRIGGER desk_order_events_no_update
  BEFORE UPDATE OR DELETE ON public.desk_order_events
  FOR EACH ROW EXECUTE FUNCTION public.desk_order_events_append_only();

-- Creates an order under the caps. One advisory lock serializes every create, so twenty
-- people ordering in the same minute can't overshoot the total. Per person and total sum
-- every order not refunded or expired. Her older `open` orders (nothing moved yet) expire
-- first, so an abandoned passkey prompt doesn't block a retry.
-- Raises 'desk_cap_per_order', 'desk_cap_per_person', or 'desk_cap_total'.
CREATE OR REPLACE FUNCTION public.desk_create_order(
  p_user_id text,
  p_smart_account text,
  p_escrow_address text,
  p_usdc_minor bigint,
  p_ars_cents bigint,
  p_rate numeric,
  p_rate_source text,
  p_rate_at timestamptz,
  p_bank_alias text,
  p_cap_per_order_minor bigint,
  p_cap_per_person_minor bigint,
  p_cap_total_minor bigint
)
RETURNS SETOF public.desk_orders
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_actor text := 'wallet:' || p_user_id;
  v_person bigint;
  v_total bigint;
  v_old record;
  v_row public.desk_orders;
BEGIN
  IF p_cap_per_order_minor IS NULL OR p_cap_per_person_minor IS NULL OR p_cap_total_minor IS NULL THEN
    RAISE EXCEPTION 'desk_caps_not_configured';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('desk_orders:caps'));

  IF p_usdc_minor > p_cap_per_order_minor THEN
    RAISE EXCEPTION 'desk_cap_per_order';
  END IF;

  FOR v_old IN
    UPDATE public.desk_orders
       SET status = 'expired', closed_at = now(), updated_at = now()
     WHERE user_id = p_user_id AND status = 'open'
    RETURNING id
  LOOP
    INSERT INTO public.desk_order_events (order_id, from_status, to_status, actor, note)
    VALUES (v_old.id, 'open', 'expired', v_actor, 'superseded by a new order');
  END LOOP;

  SELECT coalesce(sum(usdc_minor), 0) INTO v_person
    FROM public.desk_orders
   WHERE (user_id = p_user_id OR smart_account = p_smart_account)
     AND status NOT IN ('refunded', 'expired');
  IF v_person + p_usdc_minor > p_cap_per_person_minor THEN
    RAISE EXCEPTION 'desk_cap_per_person';
  END IF;

  SELECT coalesce(sum(usdc_minor), 0) INTO v_total
    FROM public.desk_orders
   WHERE status NOT IN ('refunded', 'expired');
  IF v_total + p_usdc_minor > p_cap_total_minor THEN
    RAISE EXCEPTION 'desk_cap_total';
  END IF;

  INSERT INTO public.desk_orders (
    user_id, smart_account, escrow_address, usdc_minor, ars_cents, rate, rate_source, rate_at,
    bank_alias, bank_alias_attested_at, status
  ) VALUES (
    p_user_id, p_smart_account, p_escrow_address, p_usdc_minor, p_ars_cents, p_rate, p_rate_source, p_rate_at,
    p_bank_alias, now(), 'open'
  )
  RETURNING * INTO v_row;

  INSERT INTO public.desk_order_events (order_id, from_status, to_status, actor)
  VALUES (v_row.id, NULL, 'open', v_actor);

  RETURN NEXT v_row;
END;
$$;

-- Compare-and-set transition plus its event row, in one transaction. Returns the updated
-- row, or no row when the order is not in one of p_from (someone else moved it first).
-- Only keys present in p_patch are written; confirmed_at keeps its first value. Same-status
-- moves record an event (her confirmation in `paid`, a failed send while `releasing`/`refunding`).
CREATE OR REPLACE FUNCTION public.desk_transition(
  p_order_id uuid,
  p_from text[],
  p_to text,
  p_actor text,
  p_patch jsonb DEFAULT '{}'::jsonb,
  p_hash text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS SETOF public.desk_orders
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_prev text;
  v_confirmed timestamptz;
  v_row public.desk_orders;
BEGIN
  SELECT status, confirmed_at INTO v_prev, v_confirmed FROM public.desk_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR NOT (v_prev = ANY (p_from)) THEN
    RETURN;
  END IF;
  -- From `paid`, only her confirmation releases, and once she confirmed it can't become a dispute.
  IF v_prev = 'paid' AND ((p_to = 'releasing' AND v_confirmed IS NULL) OR (p_to = 'disputed' AND v_confirmed IS NOT NULL)) THEN
    RETURN;
  END IF;

  IF (v_prev, p_to) NOT IN (
    ('open', 'locked'), ('expired', 'locked'), ('open', 'expired'),
    ('locked', 'paid'), ('locked', 'refunding'),
    ('paid', 'paid'), ('paid', 'releasing'), ('paid', 'disputed'),
    ('disputed', 'releasing'), ('disputed', 'refunding'),
    ('releasing', 'releasing'), ('releasing', 'released'),
    ('refunding', 'refunding'), ('refunding', 'refunded')
  ) THEN
    RAISE EXCEPTION 'desk_illegal_transition % -> %', v_prev, p_to;
  END IF;

  UPDATE public.desk_orders d SET
    status = p_to,
    lock_hash = CASE WHEN p_patch ? 'lock_hash' THEN p_patch->>'lock_hash' ELSE d.lock_hash END,
    locked_at = CASE WHEN p_patch ? 'locked_at' THEN (p_patch->>'locked_at')::timestamptz ELSE d.locked_at END,
    pay_deadline = CASE WHEN p_patch ? 'pay_deadline' THEN (p_patch->>'pay_deadline')::timestamptz ELSE d.pay_deadline END,
    paid_at = CASE WHEN p_patch ? 'paid_at' THEN (p_patch->>'paid_at')::timestamptz ELSE d.paid_at END,
    bank_ref = CASE WHEN p_patch ? 'bank_ref' THEN p_patch->>'bank_ref' ELSE d.bank_ref END,
    paid_by = CASE WHEN p_patch ? 'paid_by' THEN p_patch->>'paid_by' ELSE d.paid_by END,
    confirm_deadline = CASE WHEN p_patch ? 'confirm_deadline' THEN (p_patch->>'confirm_deadline')::timestamptz ELSE d.confirm_deadline END,
    confirmed_at = CASE WHEN p_patch ? 'confirmed_at' THEN coalesce(d.confirmed_at, (p_patch->>'confirmed_at')::timestamptz) ELSE d.confirmed_at END,
    release_hash = CASE WHEN p_patch ? 'release_hash' THEN p_patch->>'release_hash' ELSE d.release_hash END,
    refund_hash = CASE WHEN p_patch ? 'refund_hash' THEN p_patch->>'refund_hash' ELSE d.refund_hash END,
    closed_at = CASE WHEN p_patch ? 'closed_at' THEN (p_patch->>'closed_at')::timestamptz ELSE d.closed_at END,
    dispute_note = CASE WHEN p_patch ? 'dispute_note' THEN p_patch->>'dispute_note' ELSE d.dispute_note END,
    witness_name = CASE WHEN p_patch ? 'witness_name' THEN p_patch->>'witness_name' ELSE d.witness_name END,
    updated_at = now()
  WHERE d.id = p_order_id
  RETURNING d.* INTO v_row;

  INSERT INTO public.desk_order_events (order_id, from_status, to_status, actor, tx_hash, note)
  VALUES (p_order_id, v_prev, p_to, p_actor, p_hash, p_note);

  RETURN NEXT v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.desk_create_order(text, text, text, bigint, bigint, numeric, text, timestamptz, text, bigint, bigint, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.desk_transition(uuid, text[], text, text, jsonb, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.desk_order_events_append_only() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.desk_create_order(text, text, text, bigint, bigint, numeric, text, timestamptz, text, bigint, bigint, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.desk_transition(uuid, text[], text, text, jsonb, text, text) TO service_role;
