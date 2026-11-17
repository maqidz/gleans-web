CREATE TABLE public.site_media_visibility (
  id text PRIMARY KEY,
  hidden boolean NOT NULL,
  edited_by text NOT NULL
);
ALTER TABLE public.site_media_visibility ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_media_visibility FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.site_media_visibility TO project_admin;

CREATE VIEW public.site_editor_media_library WITH (security_invoker = true) AS
SELECT assets.id, assets.name, assets.src, assets.size, assets.updated_at, coalesce(v.hidden, false) AS hidden
FROM (
  SELECT id::text, name, url AS src, bytes AS size, updated_at FROM public.site_media
  UNION ALL
  VALUES
    ('cover-edukasi', 'Cover Edukasi', '/images/blog-thumbnail-edukasi.jpg', 0, NULL::timestamptz),
    ('cover-tutorial', 'Cover Tutorial', '/images/blog-thumbnail-tutorial.jpg', 0, NULL::timestamptz),
    ('cover-tips', 'Cover Tips & Trik', '/images/blog-thumbnail-tips.jpg', 0, NULL::timestamptz)
) AS assets
LEFT JOIN public.site_media_visibility v ON v.id = assets.id;

REVOKE ALL ON public.site_editor_media_library FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.site_editor_media_library TO project_admin;

CREATE FUNCTION public.record_media_visibility()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE media_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.hidden = NEW.hidden THEN RETURN NEW; END IF;
  SELECT name INTO STRICT media_name FROM public.site_editor_media_library WHERE id = NEW.id;
  INSERT INTO public.site_editor_activity (actor, action, object)
    VALUES (NEW.edited_by, CASE WHEN NEW.hidden THEN 'Menghapus dari pustaka media' ELSE 'Memulihkan media' END, media_name);
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.record_media_visibility() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_media_visibility() TO project_admin;
CREATE TRIGGER site_media_visibility_activity AFTER INSERT OR UPDATE ON public.site_media_visibility
FOR EACH ROW EXECUTE FUNCTION public.record_media_visibility();
