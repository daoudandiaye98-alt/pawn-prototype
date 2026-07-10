ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS length_cm numeric,
  ADD COLUMN IF NOT EXISTS width_cm numeric,
  ADD COLUMN IF NOT EXISTS height_cm numeric,
  ADD COLUMN IF NOT EXISTS care_instructions text,
  ADD COLUMN IF NOT EXISTS made_in text,
  ADD COLUMN IF NOT EXISTS edition_info text,
  ADD COLUMN IF NOT EXISTS designer_note text;