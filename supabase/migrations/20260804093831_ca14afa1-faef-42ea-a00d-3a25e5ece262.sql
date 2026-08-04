ALTER TABLE public.acquisition_leads
  ADD COLUMN IF NOT EXISTS contact_url text,
  ADD COLUMN IF NOT EXISTS contact_channel text,
  ADD COLUMN IF NOT EXISTS contact_attempts integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS acquisition_leads_status_score_idx
  ON public.acquisition_leads (status, kurator_score DESC);

CREATE INDEX IF NOT EXISTS acquisition_leads_channel_idx
  ON public.acquisition_leads (contact_channel, status);