-- PAWN Stripe Connect — Geld fließt direkt zum Designer

ALTER TABLE public.designers
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_details_submitted boolean NOT NULL DEFAULT false;

-- Buchhaltungs-Spur: welcher Anteil ging als Plattformgebühr ab, auf welches Connect-Konto ging der Rest.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS application_fee_cents int,
  ADD COLUMN IF NOT EXISTS destination_account text;

-- Jarvis-Wissen (Herzschlag): published Designer mit Produkten, aber seit >3 Tagen ohne aktives Connect-Konto,
-- können nicht verkaufen — das prüft ab jetzt ein neuer Herzschlag-Check (checkConnect in pawn-jarvis/index.ts).
