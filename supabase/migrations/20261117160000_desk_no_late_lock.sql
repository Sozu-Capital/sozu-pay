-- An expired desk order must not be locked later.
-- desk_create_order frees cap space by expiring older open orders. Reviving one
-- of those with expired -> locked counted both orders against the cap.

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
    ('open', 'locked'), ('open', 'expired'),
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


REVOKE ALL ON FUNCTION public.desk_transition(uuid, text[], text, text, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.desk_transition(uuid, text[], text, text, jsonb, text, text) TO service_role;
