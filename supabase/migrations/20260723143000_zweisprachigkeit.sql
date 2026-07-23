-- Teil 8c: Zweisprachigkeit — site_content bekommt eine englische Spalte je
-- Schlüssel. Rein additiv: bestehende Werte in `value` bleiben unverändert
-- Deutsch, `value_en` ist NULL bis ein Admin auf /admin/texte-bilder eine
-- Übersetzung bestätigt (Vorschläge über die neue Edge Function
-- suggest-translation, nie automatisch veröffentlicht).
ALTER TABLE public.site_content ADD COLUMN IF NOT EXISTS value_en jsonb;
