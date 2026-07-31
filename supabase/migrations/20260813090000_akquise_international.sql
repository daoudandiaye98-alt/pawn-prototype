-- Teil 22a: Akquise international. Die Erstnachricht wird in der Sprache des
-- Hauses verfasst (erkannt aus Bio), mit Deutsch/Englisch als Rückfall.
ALTER TABLE public.acquisition_leads
  ADD COLUMN IF NOT EXISTS language text;

-- akquise_config: welche Sprachen der Kurator unterstützt (steuert, in welchen
-- Sprachen Erstnachrichten verfasst werden können) — Häuser außerhalb
-- Deutschlands können jetzt genauso angeschrieben werden.
UPDATE public.ai_config
SET value = jsonb_set(value, '{languages}', '["de","en"]'::jsonb)
WHERE key = 'akquise_config' AND NOT (value ? 'languages');
