-- Teil 9b: Vertrauen, Gedächtnis, Selbstbau.
-- Neue Vertrauens-Zonen je Organ (ersetzt den alten Einzel-Schalter
-- akquise_config.autosend_email — akquise_senden startet hier auf Rot,
-- genau wie der bisherige Default autosend_email=false). Editierbar über
-- die Tafel im Cockpit (/admin).
INSERT INTO public.ai_config (key, value)
VALUES ('jarvis_zones', '{
  "heartbeat": "gruen",
  "wissen": "gruen",
  "akquise_kuratieren": "gruen",
  "akquise_verfassen": "gruen",
  "akquise_senden": "rot",
  "bewerbung_pruefen": "gruen",
  "kampagnen_regie": "gruen",
  "evolution": "gruen",
  "jarvis_bauplan": "gruen"
}'::jsonb)
ON CONFLICT (key) DO NOTHING;
