CREATE TABLE IF NOT EXISTS public.acquisition_hunts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  query_type text NOT NULL DEFAULT 'hashtag',
  world text NOT NULL DEFAULT 'Mode',
  apify_actor_id text NOT NULL,
  apify_run_id text,
  apify_dataset_id text,
  status text NOT NULL DEFAULT 'gestartet',
  items_found integer NOT NULL DEFAULT 0,
  leads_created integer NOT NULL DEFAULT 0,
  qualified_count integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.acquisition_hunts TO authenticated;
GRANT ALL ON public.acquisition_hunts TO service_role;
ALTER TABLE public.acquisition_hunts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins verwalten Jagden" ON public.acquisition_hunts;
CREATE POLICY "Admins verwalten Jagden" ON public.acquisition_hunts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS acquisition_hunts_status_idx ON public.acquisition_hunts (status, created_at DESC);

ALTER TABLE public.acquisition_leads
  ADD COLUMN IF NOT EXISTS hunt_id uuid REFERENCES public.acquisition_hunts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discovery_source text;

CREATE INDEX IF NOT EXISTS acquisition_leads_hunt_idx ON public.acquisition_leads (hunt_id);