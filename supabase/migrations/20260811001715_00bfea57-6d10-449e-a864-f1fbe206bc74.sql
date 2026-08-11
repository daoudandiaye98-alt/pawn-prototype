ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS application_fee_refunded_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dispute_updated_at timestamptz;