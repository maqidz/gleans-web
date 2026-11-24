-- Keep the current behavior until an admin explicitly turns notifications off.
ALTER TABLE public.whatsapp_settings ADD COLUMN enabled boolean NOT NULL DEFAULT true;
GRANT UPDATE(enabled) ON public.whatsapp_settings TO project_admin;
GRANT DELETE ON public.whatsapp_message_templates TO project_admin;

CREATE OR REPLACE FUNCTION public.read_whatsapp_template_library() RETURNS jsonb LANGUAGE sql
SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT jsonb_build_object(
  'settings',jsonb_build_object('template',s.template,'revision',s.revision,'promoId',s.promo_id,'activeTemplateId',s.active_template_id,'enabled',s.enabled),
  'templates',coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'template',t.template,'promoId',t.promo_id) ORDER BY t.created_at,t.id)
    FROM (SELECT * FROM public.whatsapp_message_templates ORDER BY created_at,id LIMIT 20) t),'[]'::jsonb)
 ) FROM public.whatsapp_settings s WHERE s.id=true
$$;
REVOKE ALL ON FUNCTION public.read_whatsapp_template_library() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_whatsapp_template_library() TO project_admin;


CREATE FUNCTION public.set_whatsapp_enabled(p_enabled boolean,p_revision integer,p_actor text)
RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE settings public.whatsapp_settings;
BEGIN
 SELECT * INTO settings FROM public.whatsapp_settings WHERE id=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'WHATSAPP_SETTINGS_UNAVAILABLE'; END IF;
 IF settings.revision<>p_revision THEN RETURN false; END IF;
 UPDATE public.whatsapp_settings SET enabled=p_enabled,revision=revision+1,edited_by=p_actor,updated_at=now() WHERE id=true;
 -- Do not burst-send old pending messages when notifications are re-enabled.
 IF NOT p_enabled THEN
  UPDATE public.shield_whatsapp_notifications SET state='skipped',failure_code='NOTIFICATIONS_DISABLED',updated_at=now()
  WHERE state='pending';
 END IF;
 IF settings.enabled IS DISTINCT FROM p_enabled THEN
  INSERT INTO public.site_editor_activity(actor,action,object)
  VALUES(p_actor,CASE WHEN p_enabled THEN 'Mengaktifkan notifikasi' ELSE 'Menonaktifkan notifikasi' END,'WhatsApp hasil Shield siap');
 END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.set_whatsapp_enabled(boolean,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_whatsapp_enabled(boolean,integer,text) TO project_admin;

CREATE FUNCTION public.delete_whatsapp_message_template(p_id uuid,p_revision integer,p_actor text)
RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE settings public.whatsapp_settings; deleted_name text;
BEGIN
 SELECT * INTO settings FROM public.whatsapp_settings WHERE id=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'WHATSAPP_SETTINGS_UNAVAILABLE'; END IF;
 IF settings.revision<>p_revision THEN RETURN false; END IF;
 IF settings.active_template_id=p_id THEN RAISE EXCEPTION 'WHATSAPP_TEMPLATE_ACTIVE'; END IF;
 DELETE FROM public.whatsapp_message_templates WHERE id=p_id RETURNING name INTO deleted_name;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.whatsapp_settings SET revision=revision+1,edited_by=p_actor,updated_at=now() WHERE id=true;
 INSERT INTO public.site_editor_activity(actor,action,object) VALUES(p_actor,'Menghapus template notifikasi',deleted_name);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.delete_whatsapp_message_template(uuid,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.delete_whatsapp_message_template(uuid,integer,text) TO project_admin;

CREATE OR REPLACE FUNCTION public.queue_shield_whatsapp() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT coalesce((SELECT enabled FROM public.whatsapp_settings WHERE id=true FOR SHARE),false) THEN RETURN NEW; END IF;
 IF TG_OP = 'UPDATE' THEN
   IF OLD.fulfillment_status = 'completed' THEN RETURN NEW; END IF;
 END IF;
 IF NEW.status='paid' AND NEW.fulfillment_status='completed' AND NEW.report_key IS NOT NULL AND NEW.report_expires_at > now() THEN
   INSERT INTO public.shield_whatsapp_notifications(order_id) VALUES (NEW.id) ON CONFLICT (order_id) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.queue_shield_whatsapp() FROM PUBLIC,anon,authenticated;


CREATE OR REPLACE FUNCTION public.claim_shield_whatsapp(p_limit integer DEFAULT 5)
RETURNS SETOF public.shield_whatsapp_notifications LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT coalesce((SELECT enabled FROM public.whatsapp_settings WHERE id=true FOR SHARE),false) THEN RETURN; END IF;
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

