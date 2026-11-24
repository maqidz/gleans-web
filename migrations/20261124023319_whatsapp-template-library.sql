CREATE TABLE public.whatsapp_message_templates (
 id uuid PRIMARY KEY,
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
 template text NOT NULL CHECK (length(btrim(template)) BETWEEN 1 AND 4000),
 promo_id text REFERENCES public.site_promotions(id) ON DELETE RESTRICT,
 edited_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (position('{link_hasil}' in template)>0 OR position('{tautan_hasil}' in template)>0)
);
CREATE UNIQUE INDEX whatsapp_message_template_name ON public.whatsapp_message_templates(lower(btrim(name)));
ALTER TABLE public.whatsapp_message_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_message_templates FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.whatsapp_message_templates TO project_admin;

-- Preserve the current message and its selected promo as Template 1.
INSERT INTO public.whatsapp_message_templates(id,name,template,promo_id,edited_by)
SELECT '11111111-1111-4111-8111-111111111111','Template 1 — Hasil & Promo',template,promo_id,edited_by
FROM public.whatsapp_settings WHERE id=true;
INSERT INTO public.whatsapp_message_templates(id,name,template,edited_by) VALUES
('22222222-2222-4222-8222-222222222222','Template 2 — Hasil Tanpa Promo',$template$Halo {nama}! ✅ Dokumen *{nama_file}* sudah selesai dicek.

📊 Skor AI: *{skor_ai}%*
🔗 Unduh laporan: {link_hasil}

Terima kasih sudah menggunakan Gleans! 🚀$template$,'Gleans');
ALTER TABLE public.whatsapp_settings ADD COLUMN active_template_id uuid REFERENCES public.whatsapp_message_templates(id) ON DELETE RESTRICT;
UPDATE public.whatsapp_settings SET active_template_id='11111111-1111-4111-8111-111111111111' WHERE id=true;
ALTER TABLE public.whatsapp_settings ALTER COLUMN active_template_id SET NOT NULL;
GRANT UPDATE(active_template_id) ON public.whatsapp_settings TO project_admin;

CREATE OR REPLACE FUNCTION public.record_whatsapp_template_activity() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='whatsapp_settings' THEN
  IF NEW.active_template_id IS DISTINCT FROM OLD.active_template_id THEN
   INSERT INTO public.site_editor_activity(actor,action,object)
   SELECT NEW.edited_by,'Memilih template notifikasi',name FROM public.whatsapp_message_templates WHERE id=NEW.active_template_id;
  END IF;
 ELSE
  INSERT INTO public.site_editor_activity(actor,action,object)
  VALUES(NEW.edited_by,CASE WHEN TG_OP='INSERT' THEN 'Menambahkan template notifikasi' ELSE 'Menyimpan template notifikasi' END,NEW.name);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER whatsapp_message_template_activity AFTER INSERT OR UPDATE ON public.whatsapp_message_templates
FOR EACH ROW EXECUTE FUNCTION public.record_whatsapp_template_activity();

CREATE FUNCTION public.read_whatsapp_template_library() RETURNS jsonb LANGUAGE sql
SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT jsonb_build_object(
  'settings',jsonb_build_object('template',s.template,'revision',s.revision,'promoId',s.promo_id,'activeTemplateId',s.active_template_id),
  'templates',coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'template',t.template,'promoId',t.promo_id) ORDER BY t.created_at,t.id)
    FROM (SELECT * FROM public.whatsapp_message_templates ORDER BY created_at,id LIMIT 20) t),'[]'::jsonb)
 ) FROM public.whatsapp_settings s WHERE s.id=true
$$;
REVOKE ALL ON FUNCTION public.read_whatsapp_template_library() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_whatsapp_template_library() TO project_admin;

-- One lock/revision protects both the library and the active message snapshot.
CREATE FUNCTION public.save_whatsapp_message_template(p_id uuid,p_name text,p_template text,p_promo text,p_revision integer,p_activate boolean,p_actor text)
RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE settings public.whatsapp_settings;
BEGIN
 SELECT * INTO settings FROM public.whatsapp_settings WHERE id=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'WHATSAPP_SETTINGS_UNAVAILABLE'; END IF;
 IF settings.revision<>p_revision THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.whatsapp_message_templates WHERE id=p_id)
    AND (SELECT count(*) FROM public.whatsapp_message_templates)>=20 THEN RAISE EXCEPTION 'WHATSAPP_TEMPLATE_LIMIT'; END IF;
 INSERT INTO public.whatsapp_message_templates(id,name,template,promo_id,edited_by)
 VALUES(p_id,btrim(p_name),p_template,p_promo,p_actor)
 ON CONFLICT(id) DO UPDATE SET name=excluded.name,template=excluded.template,promo_id=excluded.promo_id,edited_by=excluded.edited_by,updated_at=now();
 IF p_activate OR settings.active_template_id=p_id THEN
  UPDATE public.whatsapp_settings SET active_template_id=p_id,template=p_template,promo_id=p_promo,revision=revision+1,edited_by=p_actor,updated_at=now() WHERE id=true;
 ELSE
  UPDATE public.whatsapp_settings SET revision=revision+1,edited_by=p_actor,updated_at=now() WHERE id=true;
 END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.save_whatsapp_message_template(uuid,text,text,text,integer,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_whatsapp_message_template(uuid,text,text,text,integer,boolean,text) TO project_admin;
