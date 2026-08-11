-- AUFTRAG "PART 49 — Autopilot" WP1: die Freigabe für E-Mail-Erstkontakte an Designer-Leads
-- wandert von der Einzelentscheidung zur Regel. Bisher gab es dafür schon einen stillen
-- Mechanismus (ai_config.akquise_config.autosend_email/autosend_min_score, ausgewertet erst
-- beim Versand in sendAkquiseBatch) — ohne jede persistierte Spur, WARUM ein Lead automatisch
-- rausging. WP1 macht die Entscheidung explizit und vorab sichtbar: ein eigener Prüflauf
-- (Modus akquise_autopilot) setzt admin_decision='auto' (unterscheidbar von der menschlichen
-- Freigabe 'ja') und hält in autopilot_checks fest, welche der acht Bedingungen wie ausfielen.
--
-- admin_decision und blocked_reason sind bereits freier Text ohne CHECK-Constraint (siehe
-- 20260801215234_3affcc26-afc3-4d54-a25e-00aaaa7dc1a9.sql) — 'auto' braucht keine
-- Constraint-Änderung, nur die neuen Spalten für den Zeitpunkt und die Prüfspur.
ALTER TABLE public.acquisition_leads
  ADD COLUMN IF NOT EXISTS autopilot_at timestamptz,
  ADD COLUMN IF NOT EXISTS autopilot_checks jsonb;

CREATE INDEX IF NOT EXISTS acquisition_leads_autopilot_exception_idx
  ON public.acquisition_leads ((autopilot_checks->>'exception_reason'))
  WHERE admin_decision IS NULL AND autopilot_checks->>'exception_reason' IS NOT NULL;
