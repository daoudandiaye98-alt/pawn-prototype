ALTER TABLE public.acquisition_leads
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS contact_source text,
  ADD COLUMN IF NOT EXISTS admin_decision text,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz;

ALTER TABLE public.acquisition_hunts
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'instagram';

ALTER TABLE public.jarvis_runs
  ADD COLUMN IF NOT EXISTS provider_used text;

CREATE INDEX IF NOT EXISTS acquisition_leads_decision_idx
  ON public.acquisition_leads (admin_decision) WHERE admin_decision IS NULL;