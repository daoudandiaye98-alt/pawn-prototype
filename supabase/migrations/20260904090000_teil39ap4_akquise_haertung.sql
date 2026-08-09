-- Teil 39 AP4 — UWG §7 + Art. 14/21 DSGVO: Akquise-E-Mails rechtlich härten.
-- unsubscribed_at: wann ein Lead sich über den Ein-Klick-Link ausgetragen hat (getrennt von
-- opt_out, das die Durchsetzung ist — beide zusammen halten fest WAS passiert ist und WANN).
-- bounce_type: 'hard'|'soft'|'complaint', vom Resend-Webhook gesetzt.
-- retention_purged_at: wann ein aussortierter/abgemeldeter Lead auf Minimaldaten reduziert wurde.

ALTER TABLE public.acquisition_leads
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS bounce_type text,
  ADD COLUMN IF NOT EXISTS retention_purged_at timestamptz;

-- Aufbewahrungsfrist konfigurierbar statt hart codiert (Default 180 Tage) — nur neue,
-- unkritische Schlüssel, die bestehende Konfiguration bleibt unverändert.
UPDATE public.ai_config SET value = jsonb_set(value, '{retention_days}', '180'::jsonb)
WHERE key = 'akquise_config' AND NOT (value ? 'retention_days');
