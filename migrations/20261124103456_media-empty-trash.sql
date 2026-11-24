-- Keep a private tombstone so deleted media cannot be restored or reattached.
-- Uploads remain in trash until storage cleanup succeeds, allowing safe retries.
CREATE TABLE public.site_media_purges (
 id text PRIMARY KEY,
 name text NOT NULL,
 src text NOT NULL,
 storage_key text,
 edited_by text NOT NULL,
 requested_at timestamptz NOT NULL DEFAULT now(),
 cleaned_at timestamptz
);
ALTER TABLE public.site_media_purges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_media_purges FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.site_media_purges TO project_admin;

CREATE OR REPLACE VIEW public.site_editor_media_library WITH (security_invoker=true) AS
SELECT assets.id,assets.name,assets.src,assets.size,assets.updated_at,coalesce(v.hidden,false) AS hidden
FROM (
 SELECT id::text,name,url AS src,bytes AS size,updated_at FROM public.site_media
 UNION ALL VALUES
 ('cover-edukasi','Cover Edukasi','/images/blog-thumbnail-edukasi.jpg',0,NULL::timestamptz),
 ('cover-tutorial','Cover Tutorial','/images/blog-thumbnail-tutorial.jpg',0,NULL::timestamptz),
 ('cover-tips','Cover Tips & Trik','/images/blog-thumbnail-tips.jpg',0,NULL::timestamptz)
) assets
LEFT JOIN public.site_media_visibility v ON v.id=assets.id
LEFT JOIN public.site_media_purges p ON p.id=assets.id
WHERE p.cleaned_at IS NULL;

CREATE FUNCTION public.protect_purged_media() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='site_media_visibility' THEN
  IF EXISTS(SELECT 1 FROM public.site_media_purges WHERE id=NEW.id) THEN RAISE EXCEPTION 'MEDIA_PURGE_STARTED'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM public.site_media_purges WHERE position(src in NEW.record::text)>0) THEN RAISE EXCEPTION 'MEDIA_PURGE_STARTED'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_purged_media() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER prevent_purged_media_restore BEFORE INSERT OR UPDATE ON public.site_media_visibility
FOR EACH ROW EXECUTE FUNCTION public.protect_purged_media();
CREATE TRIGGER prevent_purged_article_media BEFORE INSERT OR UPDATE ON public.site_articles
FOR EACH ROW EXECUTE FUNCTION public.protect_purged_media();
CREATE TRIGGER prevent_purged_promotion_media BEFORE INSERT OR UPDATE ON public.site_promotions
FOR EACH ROW EXECUTE FUNCTION public.protect_purged_media();

CREATE FUNCTION public.prepare_site_media_purge(p_ids text[],p_actor text) RETURNS jsonb LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE item record; media_key text; skipped text[]:='{}'; target text;
BEGIN
 IF cardinality(p_ids) NOT BETWEEN 1 AND 203 OR p_ids IS NULL THEN RAISE EXCEPTION 'INVALID_MEDIA_SELECTION'; END IF;
 -- Serialize restore and content writes with the reference check and tombstone.
 LOCK TABLE public.site_media_visibility IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE public.site_articles,public.site_promotions IN SHARE MODE;
 FOR target IN SELECT DISTINCT unnest(p_ids) LOOP
  IF EXISTS(SELECT 1 FROM public.site_media_purges WHERE id=target) THEN CONTINUE; END IF;
  SELECT id,name,src INTO item FROM public.site_editor_media_library WHERE id=target AND hidden=true;
  IF NOT FOUND THEN skipped:=array_append(skipped,target); CONTINUE; END IF;
  IF EXISTS(SELECT 1 FROM public.site_articles WHERE position(item.src in record::text)>0)
     OR EXISTS(SELECT 1 FROM public.site_promotions WHERE position(item.src in record::text)>0) THEN
   skipped:=array_append(skipped,target); CONTINUE;
  END IF;
  SELECT storage_key INTO media_key FROM public.site_media WHERE id::text=target;
  INSERT INTO public.site_media_purges(id,name,src,storage_key,edited_by,cleaned_at)
  VALUES(item.id,item.name,item.src,media_key,p_actor,CASE WHEN media_key IS NULL THEN now() ELSE NULL END);
  INSERT INTO public.site_editor_activity(actor,action,object) VALUES(p_actor,'Menghapus media permanen',item.name);
 END LOOP;
 RETURN jsonb_build_object('skippedIds',to_jsonb(skipped), 'entries',coalesce((
  SELECT jsonb_agg(jsonb_build_object('id',id,'storageKey',storage_key,'cleaned',cleaned_at IS NOT NULL) ORDER BY id)
  FROM public.site_media_purges WHERE id=ANY(p_ids)
 ),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.prepare_site_media_purge(text[],text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_site_media_purge(text[],text) TO project_admin;
