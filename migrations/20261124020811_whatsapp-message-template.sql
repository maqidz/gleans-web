CREATE TABLE public.whatsapp_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 template text NOT NULL CHECK (length(btrim(template)) BETWEEN 1 AND 4000),
 revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
 edited_by text NOT NULL DEFAULT 'Gleans',
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (position('{invoice}' in template)>0 AND position('{tautan_hasil}' in template)>0)
);
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE(template,revision,edited_by,updated_at) ON public.whatsapp_settings TO project_admin;
INSERT INTO public.whatsapp_settings(template) VALUES ($template$*Gleans Shield — Hasil pemeriksaan siap*

Halo {nama}, pemeriksaan pesanan {invoice} sudah selesai.

Dokumen: {dokumen}

Lihat dan unduh hasil PDF melalui:
{tautan_hasil}

Hasil tersedia sampai {batas_unduh}. Buka melalui browser saat memesan atau masuk ke akun yang digunakan untuk memesan.

Terima kasih sudah menggunakan Gleans!$template$);

CREATE FUNCTION public.record_whatsapp_template_activity() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NEW.template IS DISTINCT FROM OLD.template THEN
  INSERT INTO public.site_editor_activity(actor,action,object)
  VALUES(NEW.edited_by,'Menyimpan template notifikasi','WhatsApp hasil Shield siap');
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.record_whatsapp_template_activity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER whatsapp_template_activity AFTER UPDATE ON public.whatsapp_settings
FOR EACH ROW EXECUTE FUNCTION public.record_whatsapp_template_activity();
