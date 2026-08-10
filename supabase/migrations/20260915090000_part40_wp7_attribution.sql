-- PART 40 "Hochtouren" · WP7 — Das Attributions-Netz.
-- Manche Bewerbungen kamen über einen Akquise-Kontakt, ohne dass der ref_code den Weg mitgenommen
-- hat (z.B. Bewerbung nicht über den Einladungslink, sondern direkt über /apply nach einer DM).
-- Diese Funktion holt das nachträglich nach: sie verknüpft nur dann, wenn der Instagram-Handle der
-- Bewerbung zu GENAU EINEM offenen Akquise-Lead passt — bei Mehrdeutigkeit lieber gar nicht
-- verknüpfen als falsch verknüpfen (Ehrlichkeitsgesetz). Admin-only, manuell ausgelöst im Feldzug.
CREATE OR REPLACE FUNCTION public.backfill_lead_attribution()
RETURNS TABLE (matched_count integer, examined_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  app RECORD;
  lead_match RECORD;
  match_count integer := 0;
  seen_count integer := 0;
  normalized_handle text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  FOR app IN
    SELECT id, instagram
    FROM public.designer_applications
    WHERE acquisition_lead_id IS NULL AND instagram IS NOT NULL AND trim(instagram) <> ''
  LOOP
    seen_count := seen_count + 1;
    normalized_handle := lower(trim(leading '@' from trim(app.instagram)));

    SELECT id, status INTO lead_match
    FROM public.acquisition_leads
    WHERE lower(trim(leading '@' from trim(handle))) = normalized_handle
    LIMIT 2;

    -- Nur bei GENAU EINEM Treffer verknüpfen (zweiter SELECT prüft Eindeutigkeit über COUNT)
    IF FOUND AND (
      SELECT count(*) FROM public.acquisition_leads
      WHERE lower(trim(leading '@' from trim(handle))) = normalized_handle
    ) = 1 THEN
      UPDATE public.designer_applications
      SET acquisition_lead_id = lead_match.id
      WHERE id = app.id;

      IF lead_match.status IS DISTINCT FROM 'gewonnen' THEN
        UPDATE public.acquisition_leads
        SET status = 'beworben', applied_at = COALESCE(applied_at, now())
        WHERE id = lead_match.id;
      END IF;

      match_count := match_count + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT match_count, seen_count;
END;
$function$;

-- Kennzahl für das Feldzug-Band: Attributionsrate über alle Bewerbungen (nicht nur die
-- unattribuierten) — "X von Y" Bewerbungen lassen sich auf einen Akquise-Kontakt zurückführen.
CREATE OR REPLACE FUNCTION public.get_attribution_stats()
RETURNS TABLE (attributed integer, total integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    count(*) FILTER (WHERE acquisition_lead_id IS NOT NULL)::int,
    count(*)::int
  FROM public.designer_applications;
END;
$function$;
