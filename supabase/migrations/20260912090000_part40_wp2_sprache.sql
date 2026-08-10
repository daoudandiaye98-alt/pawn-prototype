-- PART 40 "Hochtouren" · WP2 — Sprachheilung: get_lead_invitation gibt zusätzlich die Sprache
-- des Leads zurück, damit Einladung.tsx und Apply.tsx die passende Sprache vorwählen können.
-- CREATE OR REPLACE mit geänderter Rückgabetabelle: alte Funktion muss zuerst weg (Postgres
-- erlaubt kein OR REPLACE bei geänderter RETURNS-TABLE-Signatur).
DROP FUNCTION IF EXISTS public.get_lead_invitation(text);

CREATE FUNCTION public.get_lead_invitation(_ref_code text)
RETURNS TABLE (handle text, world text, personal_line text, lead_type text, language text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT handle, world, personal_line, lead_type, language
  FROM public.acquisition_leads
  WHERE ref_code = upper(trim(_ref_code))
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_lead_invitation(text) TO anon, authenticated;
