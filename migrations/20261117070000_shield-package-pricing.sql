ALTER TABLE public.shield_pricing
  ADD COLUMN starter_price integer NOT NULL DEFAULT 35000 CHECK (starter_price BETWEEN 1 AND 1000000),
  ADD COLUMN standart_price integer NOT NULL DEFAULT 65000 CHECK (standart_price BETWEEN 1 AND 1000000),
  ADD COLUMN premium_price integer NOT NULL DEFAULT 150000 CHECK (premium_price BETWEEN 1 AND 1000000);

GRANT UPDATE (starter_price, standart_price, premium_price) ON public.shield_pricing TO project_admin;

CREATE OR REPLACE FUNCTION public.reserve_billing_transaction(
  p_id text, p_owner uuid, p_request uuid, p_kind text, p_method text,
  p_amount integer, p_plan text, p_quota integer
)
RETURNS jsonb LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  purchase public.billing_transactions;
  package_price integer;
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
  IF p_kind = 'package' THEN
    -- A price update and a new transaction cannot pass each other mid-reservation.
    SELECT CASE p_plan
      WHEN 'starter' THEN starter_price
      WHEN 'standart' THEN standart_price
      WHEN 'premium' THEN premium_price
    END INTO package_price
    FROM public.shield_pricing WHERE id FOR SHARE;
    IF package_price IS NULL THEN
      RAISE EXCEPTION 'INVALID_BILLING_PURCHASE';
    END IF;
    IF p_amount IS DISTINCT FROM package_price THEN
      RAISE EXCEPTION 'BILLING_PRICE_CHANGED' USING DETAIL = package_price::text;
    END IF;
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
