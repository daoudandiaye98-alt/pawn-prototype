-- Teil 39 AP1 — Rechtssicherheit: Kündigungsbutton (§312k BGB) braucht eine Stelle, an der wir
-- das laufende Stripe-Abo eines Hauses überhaupt wiederfinden — die gab es bisher nicht.
-- Zusätzlich: optionale GPSR-Pflichtangaben je Stück (Hersteller/Verantwortliche/Warnhinweis),
-- nur angezeigt, wenn ein Haus sie ausfüllt (keine Pflicht, keine Fake-Daten).

alter table public.designers
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_customer_id text;

comment on column public.designers.stripe_subscription_id is
  'Teil 39 AP1: aktuelles Abo bei Stripe (Paid-Plan) — wird von stripe-webhook gepflegt, Grundlage für den Kündigungsbutton.';

alter table public.products
  add column if not exists gpsr_manufacturer_name text,
  add column if not exists gpsr_manufacturer_address text,
  add column if not exists gpsr_eu_responsible text,
  add column if not exists gpsr_safety_warning text;

comment on column public.products.gpsr_manufacturer_name is
  'Teil 39 AP1 (GPSR): Name der Herstellerin/des Herstellers. Optional — wird auf der Produktseite nur angezeigt, wenn gefüllt.';
comment on column public.products.gpsr_eu_responsible is
  'Teil 39 AP1 (GPSR): verantwortliche Person/Firma in der EU, falls Hersteller außerhalb der EU sitzt.';
