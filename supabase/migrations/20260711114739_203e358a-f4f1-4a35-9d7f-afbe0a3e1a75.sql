
ALTER TABLE public.product_shot_requests
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'studio',
  ADD COLUMN IF NOT EXISTS model_style text;

CREATE INDEX IF NOT EXISTS idx_product_shot_requests_designer_mode_created
  ON public.product_shot_requests (designer_id, mode, created_at DESC);
