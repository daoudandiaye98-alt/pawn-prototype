-- Teil 39 AP3 — KI-VO Art. 50: Kennzeichnungspflicht für synthetische Personen in Medien.
-- shows_synthetic_person markiert Bild-/Video-Material, das ein KI-generiertes Model
-- (Virtual Try-On) zeigt — nie reine Produktfotos/Freisteller. Wird beim Erzeugen gesetzt
-- (StudioCampaignNew liest den Try-On-Status, poll-broll liest campaigns.content.tryon).

ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS shows_synthetic_person boolean NOT NULL DEFAULT false;

ALTER TABLE public.video_assets
  ADD COLUMN IF NOT EXISTS shows_synthetic_person boolean NOT NULL DEFAULT false;

-- Teil 39 AP3 — redaktionelle Prüfung in der Ausspielkette (posting_queue): wer einen
-- Entwurf freigegeben hat, muss nachvollziehbar sein, bevor er tatsächlich ausgespielt wird.
ALTER TABLE public.posting_queue
  ADD COLUMN IF NOT EXISTS geprueft_von uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS geprueft_am timestamptz;

-- promote_posting_suggestion (Freigeben-Knopf in /admin/posting) stempelt ab jetzt, wer einen
-- KI-Vorschlag redaktionell geprüft und freigegeben hat, bevor er in die echte Warteschlange
-- rutscht. Funktionskörper 1:1 aus 20260803090000_verkauf_ausrichtung.sql übernommen, nur die
-- UPDATE-Zeile erweitert (CREATE OR REPLACE erhält Berechtigungen/Grants).
CREATE OR REPLACE FUNCTION public.promote_posting_suggestion(p_queue_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  slot_day date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  count_on_day int;
  slot_time timestamptz;
  landed_day date;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.posting_queue WHERE id = p_queue_id AND status = 'vorschlag') THEN
    RETURN;
  END IF;
  LOOP
    SELECT count(*) INTO count_on_day
      FROM public.posting_queue
      WHERE (scheduled_at AT TIME ZONE 'Europe/Berlin')::date = slot_day
        AND status IN ('queued', 'posted');
    IF count_on_day < 3 THEN
      slot_time := (slot_day::timestamp + interval '10 hours' + (count_on_day * interval '4 hours')) AT TIME ZONE 'Europe/Berlin';
      IF slot_time < now() THEN slot_time := now() + interval '2 hours'; END IF;
      landed_day := slot_day;
      EXIT;
    END IF;
    slot_day := slot_day + 1;
  END LOOP;

  UPDATE public.posting_queue
    SET status = 'queued', scheduled_at = slot_time, geprueft_von = auth.uid(), geprueft_am = now()
    WHERE id = p_queue_id;
  PERFORM public.resequence_posting_queue_day(landed_day);
END;
$$;

REVOKE ALL ON FUNCTION public.promote_posting_suggestion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_posting_suggestion(uuid) TO authenticated;
