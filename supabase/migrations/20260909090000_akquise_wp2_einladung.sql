-- PART "Die ersten Fünfzig" · WP2 — die Einladungsseite /einladung/{ref_code}.
-- Zwei schreibgeschützte, eng zugeschnittene RPCs für anonyme Besucher:innen. RLS auf
-- acquisition_leads bleibt unverändert (admin-only) — diese Funktionen laufen SECURITY DEFINER
-- und geben absichtlich nur die für die Einladungsseite nötigen, unkritischen Felder heraus.

CREATE OR REPLACE FUNCTION public.get_lead_invitation(_ref_code text)
RETURNS TABLE (handle text, world text, personal_line text, lead_type text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT handle, world, personal_line, lead_type
  FROM public.acquisition_leads
  WHERE ref_code = upper(trim(_ref_code))
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_lead_invitation(text) TO anon, authenticated;

-- Founding-Zähler: echte Anzahl angenommener Häuser (status='active'), unabhängig davon, ob die
-- Hausseite schon veröffentlicht ist — "designers public read" (RLS) verlangt published=true und
-- würde sonst untertreiben.
CREATE OR REPLACE FUNCTION public.count_founding_designers()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT count(*)::int FROM public.designers WHERE status = 'active';
$function$;

GRANT EXECUTE ON FUNCTION public.count_founding_designers() TO anon, authenticated;
