-- Teil 10a: fal-Warteschlangen-Kennungen (request_id/status_url/response_url) lagen bisher
-- in der error-Spalte und wurden beim Scheitern überschrieben — ein fertiges Rendering war
-- damit unrettbar verloren. Neue, eigene Spalte dafür; error bleibt ab jetzt echten Fehlern
-- vorbehalten. Rein additiv, keine bestehende Spalte/Constraint angefasst.
ALTER TABLE public.generation_requests
  ADD COLUMN IF NOT EXISTS provider_handles jsonb;

-- Neues Organ "Einsammeln" (broll_einsammeln) braucht eine Zone wie jedes andere — additiv, ohne
-- eine bereits von Daouda gesetzte Zone für ein bestehendes Organ zu überschreiben.
UPDATE public.ai_config
SET value = value || '{"broll_einsammeln": "gruen"}'::jsonb
WHERE key = 'jarvis_zones' AND NOT (value ? 'broll_einsammeln');

