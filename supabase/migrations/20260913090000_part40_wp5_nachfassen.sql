-- PART 40 "Hochtouren" · WP5 — Die Rampe auf Hochtouren: zwei neue, rein additive Spalten für
-- automatisch vorbereitete (nie automatisch versendete) Nachfass-Entwürfe im DM/Instagram-Kanal.
-- Getrennt von der bestehenden E-Mail-Nachfass-Spur (followup_at/next_touch_at), die einen anderen,
-- automatisierten Kanal bedient (siehe akquise_senden) — DMs bleiben Handarbeit (Entwurfs-Prinzip).
ALTER TABLE public.acquisition_leads
  ADD COLUMN IF NOT EXISTS dm_followup_draft text,
  ADD COLUMN IF NOT EXISTS dm_followup_sent_at timestamptz;
