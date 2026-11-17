CREATE TABLE public.shield_pricing (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  price integer NOT NULL CHECK (price BETWEEN 1 AND 1000000)
);

INSERT INTO public.shield_pricing (price) VALUES (8000);

ALTER TABLE public.shield_pricing ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shield_pricing FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE (price) ON public.shield_pricing TO project_admin;
