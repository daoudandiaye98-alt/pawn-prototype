-- PART 40 "Hochtouren" · WP6 — Das Annahme-Flywheel: ehrlicher Sozialbeweis auf der
-- Einladungsseite. Nur echte, veröffentlichte Häuser — nie Platzhalter, nie erfunden.
-- Läuft SECURITY DEFINER wie get_lead_invitation/count_founding_designers (gleiche Datei-Familie),
-- gibt absichtlich nur Markenname + Welt heraus (öffentlich unkritisch, published=true).
CREATE OR REPLACE FUNCTION public.get_founding_social_proof()
RETURNS TABLE (brand_name text, world text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT brand_name, tags[1] AS world
  FROM public.designers
  WHERE status = 'active' AND published = true AND brand_name IS NOT NULL
  ORDER BY house_number ASC NULLS LAST, created_at ASC
  LIMIT 3;
$function$;

GRANT EXECUTE ON FUNCTION public.get_founding_social_proof() TO anon, authenticated;
