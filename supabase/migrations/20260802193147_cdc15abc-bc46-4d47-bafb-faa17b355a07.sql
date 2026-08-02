ALTER TABLE public.acquisition_leads
  ADD COLUMN IF NOT EXISTS lead_type text NOT NULL DEFAULT 'designer',
  ADD COLUMN IF NOT EXISTS outlet text,
  ADD COLUMN IF NOT EXISTS contact_name text;

ALTER TABLE public.acquisition_leads
  DROP CONSTRAINT IF EXISTS acquisition_leads_lead_type_check;
ALTER TABLE public.acquisition_leads
  ADD CONSTRAINT acquisition_leads_lead_type_check
  CHECK (lead_type IN ('designer', 'presse', 'kunde'));

CREATE INDEX IF NOT EXISTS acquisition_leads_type_status_idx
  ON public.acquisition_leads (lead_type, status);

CREATE TABLE IF NOT EXISTS public.growth_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT false,
  daily_cap integer NOT NULL DEFAULT 10,
  zone text NOT NULL DEFAULT 'gelb',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.growth_channels TO authenticated;
GRANT ALL ON public.growth_channels TO service_role;

ALTER TABLE public.growth_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins verwalten Wachstums-Kanaele" ON public.growth_channels;
CREATE POLICY "Admins verwalten Wachstums-Kanaele"
  ON public.growth_channels FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS growth_channels_touch ON public.growth_channels;
CREATE TRIGGER growth_channels_touch
  BEFORE UPDATE ON public.growth_channels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();