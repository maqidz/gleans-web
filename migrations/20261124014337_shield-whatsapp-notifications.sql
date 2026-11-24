-- Server-only outbox. Only a newly published, paid Shield report creates a message.
-- Existing reports are deliberately not backfilled and billing transactions are not observed.
CREATE TABLE public.shield_whatsapp_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id text NOT NULL UNIQUE REFERENCES public.duitku_orders(id) ON DELETE CASCADE,
 state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','processing','accepted','failed','uncertain','skipped')),
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
 available_at timestamptz NOT NULL DEFAULT now(),
 claim_token uuid,
 claimed_at timestamptz,
 provider_id text,
 failure_code text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shield_whatsapp_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shield_whatsapp_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shield_whatsapp_notifications TO project_admin;
CREATE INDEX shield_whatsapp_due ON public.shield_whatsapp_notifications(available_at, created_at) WHERE state='pending';

CREATE FUNCTION public.queue_shield_whatsapp() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF TG_OP = 'UPDATE' THEN
   IF OLD.fulfillment_status = 'completed' THEN RETURN NEW; END IF;
 END IF;
 IF NEW.status='paid' AND NEW.fulfillment_status='completed' AND NEW.report_key IS NOT NULL AND NEW.report_expires_at > now() THEN
   INSERT INTO public.shield_whatsapp_notifications(order_id) VALUES (NEW.id) ON CONFLICT (order_id) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.queue_shield_whatsapp() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER shield_report_whatsapp AFTER INSERT OR UPDATE OF fulfillment_status ON public.duitku_orders
FOR EACH ROW EXECUTE FUNCTION public.queue_shield_whatsapp();

CREATE FUNCTION public.claim_shield_whatsapp(p_limit integer DEFAULT 5)
RETURNS SETOF public.shield_whatsapp_notifications LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 -- The worker might have stopped after sending. Never automatically resend expired leases.
 UPDATE public.shield_whatsapp_notifications
 SET state='uncertain',failure_code='WORKER_LEASE_EXPIRED',updated_at=now()
 WHERE state='processing' AND claimed_at < now()-interval '2 minutes';
 RETURN QUERY
 WITH due AS (
   SELECT id FROM public.shield_whatsapp_notifications
   WHERE state='pending' AND available_at<=now() AND attempts<5
   ORDER BY available_at,created_at,id FOR UPDATE SKIP LOCKED LIMIT greatest(1,least(p_limit,5))
 )
 UPDATE public.shield_whatsapp_notifications n
 SET state='processing',attempts=n.attempts+1,claim_token=gen_random_uuid(),claimed_at=now(),updated_at=now()
 FROM due WHERE n.id=due.id RETURNING n.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_shield_whatsapp(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_shield_whatsapp(integer) TO project_admin;

CREATE FUNCTION public.finish_shield_whatsapp(p_id uuid,p_claim uuid,p_state text,p_provider text,p_failure text)
RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF p_state NOT IN ('accepted','pending','failed','uncertain','skipped') THEN RAISE EXCEPTION 'INVALID_NOTIFICATION_STATE'; END IF;
 UPDATE public.shield_whatsapp_notifications
 SET state=CASE WHEN p_state='pending' AND attempts>=5 THEN 'failed' ELSE p_state END,
     provider_id=left(p_provider,200),failure_code=left(p_failure,100),updated_at=now(),
     available_at=now()+make_interval(secs=>least(3600,60*power(2,attempts)::integer)),
     claim_token=NULL,claimed_at=NULL
 WHERE id=p_id AND state='processing' AND claim_token=p_claim;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.finish_shield_whatsapp(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_shield_whatsapp(uuid,uuid,text,text,text) TO project_admin;
