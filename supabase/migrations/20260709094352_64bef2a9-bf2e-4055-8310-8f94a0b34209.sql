
ALTER TABLE public.designers
  ADD COLUMN IF NOT EXISTS image_usage_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS image_usage_consent_at timestamptz;
