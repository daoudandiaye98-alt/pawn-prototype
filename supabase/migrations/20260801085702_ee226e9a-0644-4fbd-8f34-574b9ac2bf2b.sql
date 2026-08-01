ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_charge_id text,
  ADD COLUMN IF NOT EXISTS connected_account_id text,
  ADD COLUMN IF NOT EXISTS refunded_amount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dispute_status text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS orders_stripe_payment_intent_idx ON public.orders (stripe_payment_intent_id);

ALTER TABLE public.designers
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS stripe_country text NOT NULL DEFAULT 'DE';

CREATE UNIQUE INDEX IF NOT EXISTS designers_stripe_account_id_key
  ON public.designers (stripe_account_id) WHERE stripe_account_id IS NOT NULL;