-- PAWN Jarvis — Teil 5: Akquise-Autopilot

ALTER TABLE public.acquisition_leads
  ADD COLUMN IF NOT EXISTS kurator_score int,
  ADD COLUMN IF NOT EXISTS score_reasons jsonb,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS channel text CHECK (channel IN ('email','dm')),
  ADD COLUMN IF NOT EXISTS message_draft text,
  ADD COLUMN IF NOT EXISTS qc_passed boolean,
  ADD COLUMN IF NOT EXISTS next_touch_at timestamptz,
  ADD COLUMN IF NOT EXISTS opt_out boolean NOT NULL DEFAULT false,
  -- Nicht Teil der ursprünglichen Spaltenliste, aber nötig, damit die Bild-Analyse per Claude Vision
  -- überhaupt etwas zu analysieren hat: die vom Scrape gefundenen Bild-URLs (Profilbild + ein paar Posts).
  ADD COLUMN IF NOT EXISTS scrape_images jsonb;

CREATE INDEX IF NOT EXISTS acquisition_leads_next_touch_idx ON public.acquisition_leads (next_touch_at) WHERE next_touch_at IS NOT NULL;

-- Konfiguration des Akquise-Autopiloten. apify_actor_id ist ein Platzhalter — Daouda trägt hier den
-- Actor ein, den er für das Instagram-Scraping nutzt (z.B. "apify/instagram-profile-scraper").
INSERT INTO public.ai_config (key, value)
VALUES ('akquise_config', '{
  "apify_actor_id": "",
  "default_world": "Mode",
  "min_score": 60,
  "email_daily_cap": 10,
  "autosend_email": false,
  "email_from": "PAWN <hallo@pawn.vision>",
  "email_reply_to": "pawnstudio.co@gmail.com",
  "followup_after_days": 5,
  "max_touches": 2
}'::jsonb)
ON CONFLICT (key) DO NOTHING;
