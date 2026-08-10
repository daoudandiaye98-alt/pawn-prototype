-- PART "Die ersten Fünfzig" · WP5 — Die Jagd härten: Dedupe-Lücke schließen, Multiplikator-Typ
-- als DB-Wert zulassen. (Die eigentliche Verzehnfachung von Lauf-Häufigkeit/Batch-Größe ist
-- Code-Verhalten in pawn-jarvis, keine Migration — siehe PR-Beschreibung.)

-- 1. Dedupe-Lücke: insertLeads() upsert-t schon lange mit onConflict:"handle", aber es gab NIE
-- eine Unique-Bedingung auf handle — der Konflikt konnte serverseitig nie erkannt werden. Vor der
-- Bedingung etwaige Bestands-Dubletten entfernen (älteste Zeile pro Handle bleibt, sie hat die
-- meiste Historie); designer_applications.acquisition_lead_id ist ON DELETE SET NULL, also sicher.
DELETE FROM public.acquisition_leads a
USING public.acquisition_leads b
WHERE a.handle = b.handle
  AND (a.created_at, a.id) > (b.created_at, b.id);

CREATE UNIQUE INDEX IF NOT EXISTS acquisition_leads_handle_key ON public.acquisition_leads (handle);

-- 2. Multiplikator als vierter lead_type (Presse-Kontakte mit großer eigener Reichweite, die
-- PAWN selbst weitertragen statt zu verkaufen — eigene Ansprache, kein Verkaufsversprechen).
ALTER TABLE public.acquisition_leads
  DROP CONSTRAINT IF EXISTS acquisition_leads_lead_type_check;
ALTER TABLE public.acquisition_leads
  ADD CONSTRAINT acquisition_leads_lead_type_check
  CHECK (lead_type IN ('designer', 'presse', 'kunde', 'multiplikator'));
