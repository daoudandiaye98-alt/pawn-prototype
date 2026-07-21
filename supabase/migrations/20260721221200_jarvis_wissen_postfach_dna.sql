-- PAWN Jarvis — Teil 4: Wissensläufe, Postfach-Auge, evolvierbare DNA

-- Geplante KI-Läufe ohne Admin-Login: geteiltes Geheimnis für den pg_cron-Job.
-- Denselben Wert hinterlegt Daouda als Lovable-Secret JARVIS_CRON_SECRET.
INSERT INTO public.ai_config (key, value)
VALUES ('jarvis_cron_secret', '{"value": "9b7007464aa46316f4e5e14d352976833321e32b2844b08fd38edef228d5ffc5"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Evolvierbare DNA: Matching-Gewichte aus dem Code gelöst, mit denselben Werten als Startwert.
INSERT INTO public.ai_config (key, value)
VALUES ('matching_weights', '{"mood": 2, "silhouette": 1.5, "material": 1, "colors": 1}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Bericht-Art "wissen" für den neuen Wissenslauf zulassen.
ALTER TABLE public.jarvis_reports DROP CONSTRAINT IF EXISTS jarvis_reports_kind_check;
ALTER TABLE public.jarvis_reports ADD CONSTRAINT jarvis_reports_kind_check
  CHECK (kind IN ('morgen','woche','recherche','antwort','diagnose','wissen'));

-- Proaktive Vorschläge: eine Meldung kann eine vorgeschlagene (noch nicht ausgeführte) Aktion tragen.
ALTER TABLE public.jarvis_notices ADD COLUMN IF NOT EXISTS suggested_action jsonb;

-- ai_config ist sonst admin-only. usePersonalization läuft aber im Browser jedes Besuchers (auch ohne
-- Login), damit die von Jarvis evolvierten Matching-Gewichte wirklich für alle gelten. Diese eine,
-- unkritische Zeile (keine Preise, keine Prompts, keine Secrets) wird deshalb öffentlich lesbar gemacht —
-- alle anderen ai_config-Zeilen bleiben über die bestehende Admin-Policy geschützt.
GRANT SELECT ON public.ai_config TO anon;
CREATE POLICY "public read matching_weights" ON public.ai_config
  FOR SELECT
  USING (key = 'matching_weights');
