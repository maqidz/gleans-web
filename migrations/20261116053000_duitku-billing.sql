CREATE TABLE public.billing_transactions (
  id text PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('topup', 'package', 'shield')),
  method text NOT NULL CHECK (method IN ('qris', 'balance', 'quota')),
  amount integer NOT NULL CHECK (amount > 0),
  plan_id text,
  quota integer NOT NULL DEFAULT 0 CHECK (quota >= 0),
  status text NOT NULL CHECK (status IN ('creating', 'pending', 'paid', 'failed', 'expired')),
  reference text UNIQUE,
  payment_url text,
  qr_string text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  checked_at timestamptz,
  UNIQUE (owner_id, request_id),
  CHECK ((status = 'paid') = (paid_at IS NOT NULL)),
  CHECK (
    (kind = 'topup' AND method = 'qris' AND plan_id IS NULL AND quota = 0) OR
    (kind = 'package' AND method IN ('qris', 'balance') AND plan_id IS NOT NULL AND quota > 0) OR
    (kind = 'shield' AND method IN ('balance', 'quota') AND plan_id IS NULL AND quota = 0)
  )
);
CREATE INDEX billing_transactions_owner_date ON public.billing_transactions(owner_id, created_at DESC, id);
ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_transactions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.billing_transactions TO project_admin;

CREATE FUNCTION public.billing_totals(p_owner uuid)
RETURNS TABLE (balance bigint, quota bigint)
LANGUAGE sql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT coalesce(sum(CASE WHEN kind = 'topup' THEN amount WHEN method = 'balance' THEN -amount ELSE 0 END), 0),
         coalesce(sum(CASE WHEN kind = 'package' THEN quota WHEN method = 'quota' THEN -1 ELSE 0 END), 0)
  FROM public.billing_transactions
  WHERE owner_id = p_owner AND status = 'paid'
$$;

CREATE FUNCTION public.reserve_billing_transaction(
  p_id text, p_owner uuid, p_request uuid, p_kind text, p_method text,
  p_amount integer, p_plan text, p_quota integer
)
RETURNS jsonb LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE purchase public.billing_transactions;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_owner::text, 713));
  SELECT * INTO purchase FROM public.billing_transactions WHERE owner_id = p_owner AND request_id = p_request;
  IF FOUND THEN
    IF purchase.kind IS DISTINCT FROM p_kind OR purchase.method IS DISTINCT FROM p_method OR
       purchase.amount IS DISTINCT FROM p_amount OR purchase.plan_id IS DISTINCT FROM p_plan THEN
      RAISE EXCEPTION 'BILLING_REQUEST_CONFLICT';
    END IF;
    RETURN jsonb_build_object('transaction', to_jsonb(purchase), 'created', false);
  END IF;
  IF p_kind NOT IN ('topup', 'package') OR p_method NOT IN ('qris', 'balance') THEN
    RAISE EXCEPTION 'INVALID_BILLING_PURCHASE';
  END IF;
  IF (SELECT count(*) FROM public.billing_transactions
      WHERE owner_id = p_owner AND kind IN ('topup', 'package') AND created_at > now() - interval '1 hour') >= 10 THEN
    RAISE EXCEPTION 'BILLING_LIMIT';
  END IF;
  IF p_method = 'balance' AND (SELECT balance FROM public.billing_totals(p_owner)) < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;
  INSERT INTO public.billing_transactions(id, owner_id, request_id, kind, method, amount, plan_id, quota, status, paid_at)
  VALUES (p_id, p_owner, p_request, p_kind, p_method, p_amount, p_plan, p_quota,
          CASE WHEN p_method = 'balance' THEN 'paid' ELSE 'creating' END,
          CASE WHEN p_method = 'balance' THEN now() END)
  RETURNING * INTO purchase;
  RETURN jsonb_build_object('transaction', to_jsonb(purchase), 'created', true);
END
$$;

-- Status and credit are the same ledger update, so a repeated callback cannot credit twice.
CREATE FUNCTION public.settle_billing_transaction(p_id text, p_amount integer, p_reference text, p_status text)
RETURNS public.billing_transactions LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE purchase public.billing_transactions;
BEGIN
  SELECT * INTO purchase FROM public.billing_transactions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR purchase.method <> 'qris' OR purchase.amount <> p_amount OR p_reference IS NULL OR
     (purchase.reference IS NOT NULL AND purchase.reference <> p_reference) OR
     p_status NOT IN ('pending', 'paid', 'expired') THEN
    RAISE EXCEPTION 'BILLING_PAYMENT_MISMATCH';
  END IF;
  IF purchase.status = 'paid' OR (purchase.status IN ('failed', 'expired') AND p_status <> 'paid') THEN
    RETURN purchase;
  END IF;
  UPDATE public.billing_transactions SET status = p_status, reference = p_reference,
    paid_at = CASE WHEN p_status = 'paid' THEN now() END
  WHERE id = p_id RETURNING * INTO purchase;
  RETURN purchase;
END
$$;

CREATE FUNCTION public.reserve_billed_shield_order(
  p_id text, p_owner uuid, p_guest text, p_access text, p_request uuid, p_ticket uuid,
  p_email text, p_name text, p_whatsapp text, p_words integer, p_amount integer, p_promo text, p_method text
)
RETURNS public.duitku_orders LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  purchase public.billing_transactions;
  shield_order public.duitku_orders;
BEGIN
  IF p_owner IS NULL OR p_method NOT IN ('balance', 'quota') THEN
    RAISE EXCEPTION 'INVALID_BILLING_PURCHASE';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_owner::text, 713));
  SELECT * INTO purchase FROM public.billing_transactions WHERE owner_id = p_owner AND request_id = p_request;
  IF FOUND THEN
    IF purchase.kind <> 'shield' OR purchase.method <> p_method THEN RAISE EXCEPTION 'BILLING_REQUEST_CONFLICT'; END IF;
    SELECT * INTO STRICT shield_order FROM public.duitku_orders WHERE id = purchase.id AND owner_id = p_owner;
    RETURN shield_order;
  END IF;
  IF p_method = 'balance' AND (SELECT balance FROM public.billing_totals(p_owner)) < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;
  IF p_method = 'quota' AND (SELECT quota FROM public.billing_totals(p_owner)) < 1 THEN
    RAISE EXCEPTION 'INSUFFICIENT_QUOTA';
  END IF;
  shield_order := public.reserve_guest_order(p_id, p_owner, p_guest, p_access, p_request, p_ticket,
    p_email, p_name, p_whatsapp, p_words, p_amount, p_promo);
  IF shield_order.id <> p_id THEN RAISE EXCEPTION 'BILLING_REQUEST_CONFLICT'; END IF;
  UPDATE public.duitku_orders SET status = 'paid', payment_method = p_method, paid_at = now(), reference = 'WALLET-' || p_id
  WHERE id = p_id RETURNING * INTO shield_order;
  INSERT INTO public.billing_transactions(id, owner_id, request_id, kind, method, amount, status, paid_at)
  VALUES (p_id, p_owner, p_request, 'shield', p_method, p_amount, 'paid', now());
  RETURN shield_order;
END
$$;

REVOKE ALL ON FUNCTION public.billing_totals(uuid),
  public.reserve_billing_transaction(text,uuid,uuid,text,text,integer,text,integer),
  public.settle_billing_transaction(text,integer,text,text),
  public.reserve_billed_shield_order(text,uuid,text,text,uuid,uuid,text,text,text,integer,integer,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_totals(uuid),
  public.reserve_billing_transaction(text,uuid,uuid,text,text,integer,text,integer),
  public.settle_billing_transaction(text,integer,text,text),
  public.reserve_billed_shield_order(text,uuid,text,text,uuid,uuid,text,text,text,integer,integer,text,text)
  TO project_admin;

CREATE FUNCTION public.claim_billing_check(p_id text, p_owner uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  UPDATE public.billing_transactions SET checked_at = now()
  WHERE id = p_id AND owner_id = p_owner AND method = 'qris' AND status IN ('creating', 'pending')
    AND (checked_at IS NULL OR checked_at <= now() - interval '30 seconds');
  RETURN FOUND;
END
$$;
REVOKE ALL ON FUNCTION public.claim_billing_check(text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_billing_check(text,uuid) TO project_admin;
