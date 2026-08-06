-- Teil 23 (Instagram-Sendemappe): eigener Kanalwert 'instagram', getrennt von der alten,
-- unspezifischen DM-Sammelkategorie — jede DM bei PAWN läuft ohnehin über Instagram.
ALTER TABLE public.acquisition_leads DROP CONSTRAINT IF EXISTS acquisition_leads_channel_check;
ALTER TABLE public.acquisition_leads ADD CONSTRAINT acquisition_leads_channel_check
  CHECK (channel IS NULL OR channel IN ('email', 'dm', 'instagram'));

-- Tagesportion und Nachfass-Frist für die Sendemappe, konfigurierbar statt hart verdrahtet.
UPDATE public.ai_config
SET value = jsonb_set(value, '{dm_daily_cap}', '20'::jsonb)
WHERE key = 'akquise_config' AND NOT (value ? 'dm_daily_cap');

UPDATE public.ai_config
SET value = jsonb_set(value, '{dm_followup_after_days}', '7'::jsonb)
WHERE key = 'akquise_config' AND NOT (value ? 'dm_followup_after_days');
