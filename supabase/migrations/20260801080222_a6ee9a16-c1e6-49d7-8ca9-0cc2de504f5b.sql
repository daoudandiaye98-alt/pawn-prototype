ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS size_variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS measurements jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS material_composition jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS care_symbols text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS lining_hardware text,
  ADD COLUMN IF NOT EXISTS sustainability_note text,
  ADD COLUMN IF NOT EXISTS vat_rate numeric;

ALTER TABLE public.designers
  ADD COLUMN IF NOT EXISTS vat_rate numeric NOT NULL DEFAULT 19,
  ADD COLUMN IF NOT EXISTS return_window_days integer NOT NULL DEFAULT 14;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS vat_rate numeric,
  ADD COLUMN IF NOT EXISTS vat_amount_cents integer;