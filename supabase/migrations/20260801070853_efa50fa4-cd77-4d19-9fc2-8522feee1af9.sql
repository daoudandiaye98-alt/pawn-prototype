CREATE TABLE public.ui_translations (
  hash text PRIMARY KEY,
  de text NOT NULL,
  en text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ui_translations TO anon;
GRANT SELECT ON public.ui_translations TO authenticated;
GRANT ALL ON public.ui_translations TO service_role;

ALTER TABLE public.ui_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Übersetzungen sind öffentlich lesbar"
ON public.ui_translations FOR SELECT
USING (true);

CREATE POLICY "Admins pflegen Übersetzungen"
ON public.ui_translations FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER ui_translations_updated_at
BEFORE UPDATE ON public.ui_translations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();