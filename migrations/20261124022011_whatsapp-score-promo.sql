ALTER TABLE public.duitku_orders ADD COLUMN ai_score numeric(5,2) CHECK (ai_score BETWEEN 0 AND 100);
CREATE FUNCTION public.protect_shield_ai_score() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF OLD.fulfillment_status='completed' AND NEW.ai_score IS DISTINCT FROM OLD.ai_score THEN
  RAISE EXCEPTION 'Published report score is immutable';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_shield_ai_score() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER shield_ai_score_immutable BEFORE UPDATE OF ai_score ON public.duitku_orders
FOR EACH ROW EXECUTE FUNCTION public.protect_shield_ai_score();

ALTER TABLE public.whatsapp_settings ADD COLUMN promo_id text REFERENCES public.site_promotions(id) ON DELETE RESTRICT;
ALTER TABLE public.whatsapp_settings DROP CONSTRAINT whatsapp_settings_template_check1;
ALTER TABLE public.whatsapp_settings ADD CONSTRAINT whatsapp_template_result_link CHECK (
 position('{link_hasil}' in template)>0 OR position('{tautan_hasil}' in template)>0
);
GRANT UPDATE(promo_id) ON public.whatsapp_settings TO project_admin;
UPDATE public.whatsapp_settings SET template=$template$Halo {nama}! ✅ Dokumen *{nama_file}* sudah selesai dicek.

📊 Skor AI: *{skor_ai}%*
🔗 Unduh laporan: {link_hasil}

Skor masih tinggi? Jangan khawatir, revisi bagian yang ditandai lalu cek ulang dengan *diskon {diskon}%* pakai kode *{kode_promo}* (berlaku {masa_berlaku}).

Revisi, cek ulang, lalu kumpulkan dengan tenang. Cek ulang sekarang di www.gleans.my.id 🚀$template$,
 promo_id=(SELECT id FROM public.site_promotions WHERE code='HEMAT5RIBU' LIMIT 1),
 revision=revision+1,updated_at=now();
